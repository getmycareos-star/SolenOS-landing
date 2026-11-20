import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

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
]);

type Callsite = { file: string; line: number; helper: string; method: string; declared_path: string; resolved_path: string; dynamic: boolean };

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [full] : [];
  });
}

function pathExpression(node: ts.Expression): { value: string; dynamic: boolean } | null {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { value: node.text, dynamic: false };
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      value += "{param}" + span.literal.text;
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

function resolvedPath(path: string): string {
  if (path === "/situation" || path.startsWith("/situation?")) return "/api" + path;
  if (path === "/api/lcr/orientation" || path.startsWith("/api/lcr/orientation?")) return path;
  if (path.startsWith("/api/v1/")) return path;
  return "/api/v1" + (path.startsWith("/") ? path : "/" + path);
}

const callsites: Callsite[] = [];
const unsupported: Array<{ file: string; line: number; helper: string }> = [];
for (const file of filesUnder(sourceRoot)) {
  const sourceText = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const helper = ts.isIdentifier(expression) ? expression.text : null;
      if (helper && helpers.has(helper)) {
        const pathArg = node.arguments[0];
        const parsed = pathArg && pathExpression(pathArg);
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        if (!parsed || !parsed.value.startsWith("/")) {
          unsupported.push({ file: relative(root, file), line, helper });
        } else {
          callsites.push({
            file: relative(root, file),
            line,
            helper,
            method: helpers.get(helper)!,
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
  a.resolved_path.localeCompare(b.resolved_path) || a.method.localeCompare(b.method) || a.file.localeCompare(b.file) || a.line - b.line
);
const grouped = new Map<string, Callsite[]>();
for (const item of sorted) {
  const key = item.method + " " + item.resolved_path;
  grouped.set(key, [...(grouped.get(key) ?? []), item]);
}

console.log("FRONTEND_API_CALLSITE_INVENTORY", JSON.stringify({
  callsite_count: sorted.length,
  distinct_method_path_pairs: grouped.size,
  unsupported_dynamic_calls: unsupported.length,
  endpoints: [...grouped.entries()].map(([key, items]) => ({
    method_path: key,
    callsite_count: items.length,
    callsites: items.map(({ file, line, helper, dynamic }) => ({ file, line, helper, dynamic })),
  })),
}, null, 2));

assert.equal(unsupported.length, 0, "Every API helper call must expose a statically auditable path expression.");
assert.ok(sorted.length > 0, "No frontend API helper calls were discovered.");
