#!/usr/bin/env node
/**
 * Static inventory of frontend HTTP/API call sites.
 *
 * Literal route prefixes are preserved; dynamic expressions are reported as
 * unresolved rather than guessed. This is a call-site inventory, not proof that
 * a corresponding backend route or workflow is correct.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const outputArg = process.argv.indexOf('--output');
const outputPath = outputArg >= 0 ? process.argv[outputArg + 1] : null;
const wrappers = new Map([
  ['getJSON', 'GET'],
  ['getBlob', 'GET'],
  ['postJSON', 'POST'],
  ['postFormData', 'POST'],
  ['putJSON', 'PUT'],
  ['patchJSON', 'PATCH'],
  ['deleteJSON', 'DELETE'],
]);

function collectFiles(directory) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', '.next', 'dist', 'build'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...collectFiles(full));
    else if (/\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(entry.name)) found.push(full);
  }
  return found;
}

function routeExpression(node) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { expression: node.text, dynamic: false };
  }
  if (ts.isTemplateExpression(node)) {
    return {
      expression: node.head.text + node.templateSpans.map(span => '{dynamic}' + span.literal.text).join(''),
      dynamic: true,
    };
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.Plus) {
    const left = routeExpression(node.left);
    const right = routeExpression(node.right);
    return {
      expression: left.expression + right.expression,
      dynamic: left.dynamic || right.dynamic || !ts.isStringLiteralLike(node.right),
    };
  }
  return { expression: node.getText().slice(0, 240), dynamic: true };
}

function methodFor(call) {
  const expression = call.expression;
  const name = ts.isIdentifier(expression) ? expression.text
    : ts.isPropertyAccessExpression(expression) ? expression.name.text : '';
  if (wrappers.has(name)) return wrappers.get(name);
  if (name !== 'fetch' && name !== 'fetchWithTimeout') return null;
  const init = call.arguments[1];
  if (init && ts.isObjectLiteralExpression(init)) {
    const method = init.properties.find(property =>
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === 'method') ||
       (ts.isStringLiteralLike(property.name) && property.name.text === 'method'))
    );
    if (method && ts.isPropertyAssignment(method) && ts.isStringLiteralLike(method.initializer)) {
      return method.initializer.text.toUpperCase();
    }
  }
  return 'GET_OR_DYNAMIC';
}

const entries = [];
for (const file of collectFiles(sourceRoot)) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const method = methodFor(node);
      if (method) {
        const route = routeExpression(node.arguments[0]);
        const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        entries.push({
          method,
          route_expression: route.expression,
          dynamic: route.dynamic || route.expression.includes('{dynamic}'),
          source_file: path.relative(root, file).split(path.sep).join('/'),
          line: location.line + 1,
          caller: node.expression.getText(sourceFile),
          classification: 'backend_match_and_workflow_review_required',
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}
entries.sort((a, b) =>
  a.source_file.localeCompare(b.source_file) ||
  a.line - b.line ||
  a.method.localeCompare(b.method)
);
const inventory = {
  format_version: 1,
  source: 'TypeScript AST scan of src/**/*.ts(x)',
  call_site_count: entries.length,
  static_call_site_count: entries.filter(item => !item.dynamic).length,
  dynamic_call_site_count: entries.filter(item => item.dynamic).length,
  call_sites: entries,
};
const rendered = JSON.stringify(inventory, null, 2) + '\n';
if (outputPath) fs.writeFileSync(path.resolve(root, outputPath), rendered);
else process.stdout.write(rendered);
console.log(
  `Indexed ${inventory.call_site_count} API call sites (${inventory.static_call_site_count} static, ${inventory.dynamic_call_site_count} dynamic).`
);
