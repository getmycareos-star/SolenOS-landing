import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import * as ts from "typescript";

const root = process.cwd();
const sourceRoot = join(root, "src");
const helpers = new Map([
  ["getJSON", "GET"],
  ["getBlob", "GET_BLOB"],
  ["postJSON", "POST"],
  ["postFormData", "POST_MULTIPART"],
  ["putJSON", "PUT"],
  ["patchJSON", "PATCH"],
  ["deleteJSON", "DELETE"],
  ["fetchWithTimeout", "GET"],
  ["fetch", "GET"],
]);

type Callsite = {
  file: string;
  line: number;
  helper: string;
  method: string;
  declared_path: string;
  resolved_path: string;
  dynamic: boolean;
  source_kind?: string;
};

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [full] : [];
  });
}

function methodForCall(node: ts.CallExpression, helper: string): string {
  if (helper !== "fetchWithTimeout" && helper !== "fetch") return helpers.get(helper)!;
  const options = node.arguments[1];
  if (options && ts.isObjectLiteralExpression(options)) {
    const method = options.properties.find(property =>
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === "method") ||
       (ts.isStringLiteral(property.name) && property.name.text === "method"))
    );
    if (method && ts.isPropertyAssignment(method) && ts.isStringLiteralLike(method.initializer)) {
      return method.initializer.text.toUpperCase();
    }
  }
  return "GET";
}

function pathExpression(node: ts.Expression): { value: string; dynamic: boolean } | null {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { value: node.text, dynamic: false };
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const expressionText = span.expression.getText();
      value += (expressionText.includes(".search") || expressionText.includes("searchParams") ? "{query}" : "{param}") + span.literal.text;
    }
    return { value, dynamic: true };
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = pathExpression(node.left);
    const right = pathExpression(node.right);
    if (!left && !right) return null;
    return {
      value: (left?.value ?? "{param}") + (right?.value ?? "{param}"),
      dynamic: true,
    };
  }
  if (ts.isParenthesizedExpression(node)) return pathExpression(node.expression);
  return null;
}

function expressionPath(node: ts.Expression | undefined): { value: string; dynamic: boolean } | null {
  if (!node) return null;
  if (ts.isNewExpression(node) && node.expression.getText().endsWith("URL")) {
    const firstArgument = node.arguments?.[0];
    return firstArgument ? pathExpression(firstArgument) : null;
  }
  return pathExpression(node);
}

function backendProxyPath(raw: string): string | null {
  let value = raw;
  const apiIndex = value.indexOf("/api/");
  if (apiIndex >= 0) value = value.slice(apiIndex);
  else if (value.startsWith("/situation")) value = "/api" + value;
  else return null;
  value = value.replace(/\\{query\\}.*$/, "");
  value = value.split("?", 1)[0];
  return value.startsWith("/api/") ? value : null;
}

function proxyMethods(node: ts.CallExpression, exportedMethods: string[]): string[] {
  const options = node.arguments[1];
  if (options && ts.isObjectLiteralExpression(options)) {
    const method = options.properties.find(property =>
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === "method") ||
       (ts.isStringLiteral(property.name) && property.name.text === "method"))
    );
    if (method && ts.isPropertyAssignment(method)) {
      if (ts.isStringLiteralLike(method.initializer)) return [method.initializer.text.toUpperCase()];
      if (ts.isPropertyAccessExpression(method.initializer) && method.initializer.name.text === "method") {
        return exportedMethods.length ? exportedMethods : ["INCOMING_METHOD"];
      }
    }
  }
  return ["GET"];
}

function resolvedPath(path: string): string {
  const normalized = path.startsWith("/") ? path : "/" + path;
  if (normalized === "/situation" || normalized.startsWith("/situation?")) return "/api" + normalized;
  if (normalized === "/api/lcr/orientation" || normalized.startsWith("/api/lcr/orientation?")) return normalized;
  if (normalized.startsWith("/api/v1/")) return normalized;
  return "/api/v1" + normalized;
}

function escapeRegex(value: string): string {
  const special = ".^$*+?()[]{}|\\";
  return value.split("").map(character => special.includes(character) ? "\\" + character : character).join("");
}

const callsites: Callsite[] = [];
const proxyCallsites: Callsite[] = [];
const unsupported: Array<{ file: string; line: number; helper: string }> = [];
const unsupportedProxyCalls: Array<{ file: string; line: number; helper: string }> = [];
for (const file of filesUnder(sourceRoot)) {
  const sourceText = readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const variablePaths = new Map<string, { value: string; dynamic: boolean }>();
  const exportedMethods = source.statements
    .filter((statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      Boolean(statement.name) &&
      ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(statement.name!.text) &&
      Boolean(statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
    )
    .map(statement => statement.name!.text);

  const collectVariables = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const parsed = expressionPath(node.initializer);
      if (parsed) variablePaths.set(node.name.text, parsed);
    }
    ts.forEachChild(node, collectVariables);
  };
  collectVariables(source);

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const helper = ts.isIdentifier(expression) ? expression.text : null;
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      if (helper && helpers.has(helper)) {
        const parsed = node.arguments[0] ? pathExpression(node.arguments[0]) : null;
        if (helper === "fetch" && (!parsed || !parsed.value.startsWith("/"))) {
          // Ignore fetch(url) inside shared transport wrappers and external URL fetches;
          // only direct same-origin API paths are backend callsites.
        } else if (!parsed || !parsed.value.trim()) {
          if (helper !== "fetchWithTimeout") unsupported.push({ file: relative(root, file), line, helper });
        } else {
          callsites.push({
            file: relative(root, file),
            line,
            helper,
            method: methodForCall(node, helper),
            declared_path: parsed.value,
            resolved_path: resolvedPath(parsed.value),
            dynamic: parsed.dynamic,
          });
        }
      }

      // Next.js route handlers proxy to FastAPI directly rather than through
      // the browser API helpers. Inventory those upstream calls separately.
      if (helper === "fetch" && file.startsWith(join(sourceRoot, "app", "api"))) {
        const first = node.arguments[0];
        const parsed = first && ts.isIdentifier(first)
          ? variablePaths.get(first.text) ?? null
          : expressionPath(first as ts.Expression);
        const backendPath = parsed ? backendProxyPath(parsed.value) : null;
        if (!parsed || !backendPath) {
          unsupportedProxyCalls.push({ file: relative(root, file), line, helper: "fetch" });
        } else {
          for (const method of proxyMethods(node, exportedMethods)) {
            proxyCallsites.push({
              file: relative(root, file),
              line,
              helper: "fetch",
              method,
              declared_path: parsed.value,
              resolved_path: backendPath,
              dynamic: parsed.dynamic,
              source_kind: "next-server-proxy",
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const unique = new Map<string, Callsite>();
for (const item of [...callsites, ...proxyCallsites]) {
  unique.set([item.file, item.line, item.helper, item.method, item.declared_path].join("|"), item);
}
const sorted = [...unique.values()].sort((a, b) =>
  a.resolved_path.localeCompare(b.resolved_path) ||
  a.method.localeCompare(b.method) ||
  a.file.localeCompare(b.file) ||
  a.line - b.line
);
const grouped = new Map<string, Callsite[]>();
for (const item of sorted) {
  const key = item.method + " " + item.resolved_path;
  grouped.set(key, [...(grouped.get(key) ?? []), item]);
}

let backendContract: {
  enabled: boolean;
  openapi_url?: string;
  registered_operations?: number;
  matched_callsite_pairs?: number;
  intentionally_disabled_pairs?: number;
  missing_operations?: Array<{ method_path: string; callsites: Callsite[] }>;
  unconsumed_backend_operations?: Array<{ method_path: string }>;
} = { enabled: false };

const openApiUrl = process.env.SOLENOS_OPENAPI_URL;
if (openApiUrl) {
  const response = await fetch(openApiUrl);
  if (!response.ok) throw new Error("Could not retrieve backend OpenAPI contract: HTTP " + response.status);
  const specification = await response.json() as { paths?: Record<string, Record<string, unknown>> };
  const registered = Object.entries(specification.paths ?? {}).flatMap(([path, operations]) =>
    Object.keys(operations)
      .filter(method => ["get", "post", "put", "patch", "delete"].includes(method.toLowerCase()))
      .map(method => ({ path, method: method.toLowerCase() }))
  );
  const missing: Array<{ method_path: string; callsites: Callsite[] }> = [];
  const matchedOperationKeys = new Set<string>();
  let matched = 0;
  let intentionallyDisabled = 0;
  for (const [key, items] of grouped.entries()) {
    const [methodLabel, rawPath] = key.split(" ", 2);
    const method = methodLabel === "GET_BLOB" ? "get" : methodLabel === "POST_MULTIPART" ? "post" : methodLabel.toLowerCase();
    const path = rawPath.split("?", 1)[0];
    if (path === "/api/v1/community" || path.startsWith("/api/v1/community/")) {
      intentionallyDisabled += 1;
      continue;
    }
    const pattern = new RegExp("^" + path.split("/").map(segment =>
      segment === "{param}" ? "[^/]+" : escapeRegex(segment)
    ).join("/") + "$");
    const matches = registered.filter(route => route.method === method && pattern.test(route.path));
    if (matches.length) {
      matched += 1;
      for (const route of matches) matchedOperationKeys.add(route.method + " " + route.path);
    } else {
      missing.push({ method_path: key, callsites: items });
    }
  }
  const unconsumed = registered
    .filter(route => !matchedOperationKeys.has(route.method + " " + route.path))
    .map(route => ({ method_path: route.method.toUpperCase() + " " + route.path }));
  backendContract = {
    enabled: true,
    openapi_url: openApiUrl,
    registered_operations: registered.length,
    matched_callsite_pairs: matched,
    intentionally_disabled_pairs: intentionallyDisabled,
    missing_operations: missing,
    unconsumed_backend_operations: unconsumed,
  };
}

const report = {
  generated_at: new Date().toISOString(),
  callsite_count: sorted.length,
  distinct_method_path_pairs: grouped.size,
  unsupported_dynamic_calls: unsupported.length,
  unsupported_calls: unsupported,
  server_proxy_callsite_count: proxyCallsites.length,
  unsupported_server_proxy_calls: unsupportedProxyCalls,
  backend_contract: backendContract,
  unconsumed_backend_operation_count: backendContract.unconsumed_backend_operations?.length ?? null,
  unconsumed_backend_operations: backendContract.unconsumed_backend_operations ?? [],
  endpoints: [...grouped.entries()].map(([key, items]) => ({
    method_path: key,
    callsite_count: items.length,
    callsites: items.map(({ file, line, helper, dynamic, source_kind }) => ({
      file, line, helper, dynamic, source_kind: source_kind ?? "browser-api-client",
    })),
  })),
};
console.log("FRONTEND_API_CALLSITE_INVENTORY", JSON.stringify(report, null, 2));
const reportPath = process.env.SOLENOS_API_INVENTORY_OUTPUT;
if (reportPath) {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
}

assert.equal(unsupported.length, 0, "Every API helper call must expose a statically auditable path expression.");
assert.ok(sorted.length > 0, "No frontend API helper calls were discovered.");
assert.equal(
  unsupportedProxyCalls.length,
  0,
  "Every Next.js backend proxy fetch must resolve to a statically auditable FastAPI path.",
);
assert.ok(
  proxyCallsites.some(item => item.method === "POST" && item.resolved_path === "/api/extract"),
  "The authenticated document extraction proxy must be included in the backend callsite inventory.",
);
assert.ok(
  proxyCallsites.some(item => item.method === "GET" && item.resolved_path.startsWith("/api/v1/share-intake/")),
  "The one-time share-intake proxy must be included in the backend callsite inventory.",
);
for (const method of ["GET", "POST", "PATCH"]) {
  assert.ok(
    proxyCallsites.some(item => item.method === method && item.resolved_path === "/api/situation"),
    `The ${method} situation proxy must be included in the backend callsite inventory.`,
  );
}
if (backendContract.enabled) {
  assert.equal(
    backendContract.missing_operations?.length ?? 0,
    0,
    "Every active frontend API helper call must match a registered backend OpenAPI method/path. Community routes are intentionally excluded.",
  );
}
