import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
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
]);

type Callsite = {
  file: string;
  line: number;
  helper: string;
  method: string;
  declared_path: string;
  resolved_path: string;
  dynamic: boolean;
};

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [full] : [];
  });
}

function methodForCall(node: ts.CallExpression, helper: string): string {
  if (helper !== "fetchWithTimeout") return helpers.get(helper)!;
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
    for (const span of node.templateSpans) value += "{param}" + span.literal.text;
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
const unsupported: Array<{ file: string; line: number; helper: string }> = [];
for (const file of filesUnder(sourceRoot)) {
  const sourceText = readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const helper = ts.isIdentifier(expression) ? expression.text : null;
      if (helper && helpers.has(helper)) {
        const parsed = node.arguments[0] ? pathExpression(node.arguments[0]) : null;
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        if (!parsed || !parsed.value.trim()) {
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
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const unique = new Map<string, Callsite>();
for (const item of callsites) {
  unique.set([item.file, item.line, item.helper, item.declared_path].join("|"), item);
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
    const exists = registered.some(route => route.method === method && pattern.test(route.path));
    if (exists) matched += 1;
    else missing.push({ method_path: key, callsites: items });
  }
  backendContract = {
    enabled: true,
    openapi_url: openApiUrl,
    registered_operations: registered.length,
    matched_callsite_pairs: matched,
    intentionally_disabled_pairs: intentionallyDisabled,
    missing_operations: missing,
  };
}

console.log("FRONTEND_API_CALLSITE_INVENTORY", JSON.stringify({
  callsite_count: sorted.length,
  distinct_method_path_pairs: grouped.size,
  unsupported_dynamic_calls: unsupported.length,
  unsupported_calls: unsupported,
  backend_contract: backendContract,
  endpoints: [...grouped.entries()].map(([key, items]) => ({
    method_path: key,
    callsite_count: items.length,
    callsites: items.map(({ file, line, helper, dynamic }) => ({ file, line, helper, dynamic })),
  })),
}, null, 2));

assert.equal(unsupported.length, 0, "Every API helper call must expose a statically auditable path expression.");
assert.ok(sorted.length > 0, "No frontend API helper calls were discovered.");
if (backendContract.enabled) {
  assert.equal(
    backendContract.missing_operations?.length ?? 0,
    0,
    "Every active frontend API helper call must match a registered backend OpenAPI method/path. Community routes are intentionally excluded.",
  );
}
