#!/usr/bin/env node
/**
 * Static inventory of frontend HTTP/API call sites.
 *
 * Literal paths are matched directly; dynamic segments are compared against
 * FastAPI path parameters by route shape. A match is not proof of correct
 * authorization, persistence, or end-to-end workflow behavior.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
const outputPath = argumentValue('--output');
const backendInventoryPath = argumentValue('--backend-inventory');
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
  if (ts.isCallExpression(node) && node.arguments.length > 0) {
    const callee = ts.isIdentifier(node.expression) ? node.expression.text
      : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '';
    if (callee === 'apiUrl' || callee === 'resolveApiUrl' || callee === 'buildApiUrl') {
      return routeExpression(node.arguments[0]);
    }
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = routeExpression(node.left);
    const right = routeExpression(node.right);
    return {
      expression: left.expression + right.expression,
      dynamic: left.dynamic || right.dynamic,
    };
  }
  return { expression: '{dynamic}', dynamic: true };
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

function normalizeFrontendPath(expression) {
  const pathOnly = expression.split('?')[0].replace(/\/$/, '') || '/';
  if (!pathOnly.startsWith('/')) return null;
  if (pathOnly === '/situation' || pathOnly.startsWith('/situation/')) return '/api' + pathOnly;
  if (pathOnly === '/api/v1' || pathOnly.startsWith('/api/v1/')) return pathOnly;
  if (pathOnly === '/api' || pathOnly.startsWith('/api/')) return pathOnly;
  return '/api/v1' + pathOnly;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
}

function routeRegex(routePath) {
  const parts = routePath.split('/').map(segment =>
    /^\{[^}]+:path\}$/.test(segment) ? '.+' :
      /^\{[^}]+\}$/.test(segment) ? '[^/]+' : escapeRegex(segment)
  );
  return new RegExp('^' + parts.join('/') + '/?$');
}

let backendRoutes = [];
let backendSource = null;
let duplicateMethodPaths = new Set();
if (backendInventoryPath) {
  const backendInventory = JSON.parse(fs.readFileSync(path.resolve(root, backendInventoryPath), 'utf8'));
  backendSource = backendInventory.source || null;
  backendRoutes = backendInventory.routes || [];
  duplicateMethodPaths = new Set(Object.keys(backendInventory.duplicate_method_paths || {}));
  for (const entry of entries) {
    const normalizedPath = normalizeFrontendPath(entry.route_expression);
    entry.normalized_backend_path = normalizedPath;
    const matches = normalizedPath
      ? backendRoutes.filter(route => {
          const backendPath = route.path || route.endpoint;
          return Boolean(backendPath)
            && (entry.method === 'GET_OR_DYNAMIC' || route.method === entry.method)
            && routeRegex(backendPath).test(normalizedPath);
        })
      : [];
    entry.matched_backend_routes = matches.map(route => ({
      method: route.method,
      path: route.path || route.endpoint,
      router_module: route.router_module,
      handler: route.handler,
    }));
    entry.backend_match_status = matches.length === 1
      ? (entry.dynamic ? 'matched_dynamic' : 'matched_static')
      : matches.length > 1 ? 'ambiguous_multiple_backend_routes' : 'no_backend_route_match';
  }
}
const backendRouteMatrix = backendRoutes.map(route => {
  const backendPath = route.path || route.endpoint;
  const consumers = entries.filter(entry =>
    entry.matched_backend_routes?.some(match => match.method === route.method && match.path === backendPath)
  );
  return {
    method: route.method,
    path: backendPath,
    router_module: route.router_module,
    handler: route.handler,
    tags: route.tags || [],
    contract: route.contract || null,
    authentication: route.authentication || route.authentication_disposition || null,
    consumer: route.consumer || route.consumer_disposition || null,
    persistence: route.persistence || route.persistence_disposition || null,
    verification: route.verification || route.verification_disposition || null,
    disposition: route.disposition || null,
    status: route.status || null,
    duplicate_registration: route.duplicate_registration === true || duplicateMethodPaths.has(`${route.method} ${backendPath}`),
    frontend_call_site_count: consumers.length,
    frontend_call_sites: consumers.map(entry => ({
      source_file: entry.source_file,
      line: entry.line,
      caller: entry.caller,
      route_expression: entry.route_expression,
    })),
    disposition: consumers.length
      ? 'frontend_callsite_found_workflow_verification_required'
      : 'no_frontend_callsite_internal_consumer_or_unused_review_required',
  };
});
const inventory = {
  format_version: 2,
  source: 'TypeScript AST scan of src TypeScript and JavaScript modules',
  frontend_source_commit: process.env.GITHUB_SHA || null,
  backend_source_commit: process.env.SOLENOS_BACKEND_SHA || null,
  backend_inventory_source: backendSource,
  backend_route_count: backendRoutes.length,
  call_site_count: entries.length,
  static_call_site_count: entries.filter(item => !item.dynamic).length,
  dynamic_call_site_count: entries.filter(item => item.dynamic).length,
  matched_call_site_count: entries.filter(item => item.backend_match_status?.startsWith('matched_')).length,
  unmatched_call_site_count: entries.filter(item => item.backend_match_status === 'no_backend_route_match').length,
  ambiguous_call_site_count: entries.filter(item => item.backend_match_status === 'ambiguous_multiple_backend_routes').length,
  backend_routes_without_frontend_callsite: backendRouteMatrix.filter(route => route.frontend_call_site_count === 0).length,
  call_sites: entries,
  backend_routes: backendRouteMatrix,
};
const rendered = JSON.stringify(inventory, null, 2) + '\n';
if (outputPath) fs.writeFileSync(path.resolve(root, outputPath), rendered);
else process.stdout.write(rendered);
console.log(
  `Indexed ${inventory.call_site_count} API call sites; matched ${inventory.matched_call_site_count}; unmatched ${inventory.unmatched_call_site_count}; backend routes ${inventory.backend_route_count}.`
);
