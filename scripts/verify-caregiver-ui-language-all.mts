import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const roots = ["src/app", "src/components"];
const sharedLanguageHelpers = ["src/lib/caregiver-language.ts"];
const excludedPathParts = [
  "/api/",
  "/ops/",
  "/ops-devtools/",
  "/ops-clarity/",
  "/ui-runtime/",
];
// Only the debug-only state visualizer is excluded from caregiver copy checks.
const excludedFiles = new Set([
  "src/components/StateVisualizer.tsx",
]);
const files: string[] = [];

function collect(directory: string): void {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    const relative = absolute.replaceAll(path.sep, "/");
    if (excludedPathParts.some((part) => relative.includes(part))) continue;
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      collect(absolute);
      continue;
    }
    if (!/\.(tsx|jsx)$/.test(relative) || /\.test\.(tsx|jsx)$/.test(relative)) continue;
    if (excludedFiles.has(relative)) continue;
    files.push(relative);
  }
}

for (const root of roots) collect(root);
files.push(...sharedLanguageHelpers);

const forbidden = /\b(?:epistemic|provenance|reconciliation|assertion|schema|database|backend|frontend|endpoint|payload|telemetry|inference|retrieval|extraction|lineage|pipeline|migration|idempotent|persistence|postgres(?:ql)?|sqlite|qwen|lcr|delta engine|open loops|diagnostic|metadata|audit trail|api|json|ocr|checksum|fingerprint|uuid|http|source attribution|candidate|projection|longitudinal|corroborat(?:e|ion|ed|ing)|triangulat(?:e|ion)|baseline|technical|integrity|claim|observation window|source id|ai interpretation|ai-generated|ai-assisted|confidence|assessment|evidence|anonymous session|care session|session token)\b/i;

type Finding = { file: string; line: number; text: string; term: string };
const findings: Finding[] = [];

function addText(sourceFile: ts.SourceFile, node: ts.Node, value: string): void {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return;
  const match = forbidden.exec(text);
  if (!match) return;
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  findings.push({ file: sourceFile.fileName, line, text: text.slice(0, 180), term: match[0] });
}

function collectDisplayExpression(sourceFile: ts.SourceFile, node: ts.Expression): void {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    addText(sourceFile, node, node.text);
    return;
  }
  if (ts.isTemplateExpression(node)) {
    addText(sourceFile, node, node.head.text);
    for (const span of node.templateSpans) addText(sourceFile, span, span.literal.text);
    return;
  }
  if (ts.isConditionalExpression(node)) {
    collectDisplayExpression(sourceFile, node.whenTrue);
    collectDisplayExpression(sourceFile, node.whenFalse);
    return;
  }
  if (ts.isBinaryExpression(node) && [
    ts.SyntaxKind.PlusToken,
    ts.SyntaxKind.BarBarToken,
    ts.SyntaxKind.QuestionQuestionToken,
    ts.SyntaxKind.AmpersandAmpersandToken,
  ].includes(node.operatorToken.kind)) {
    collectDisplayExpression(sourceFile, node.left);
    collectDisplayExpression(sourceFile, node.right);
    return;
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) {
    collectDisplayExpression(sourceFile, node.expression);
  }
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") || file.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  function collectFunctionReturns(node: ts.Node): void {
    if (ts.isReturnStatement(node) && node.expression) {
      collectDisplayExpression(sourceFile, node.expression);
      return;
    }
    ts.forEachChild(node, collectFunctionReturns);
  }

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
      ts.isObjectLiteralExpression(node.initializer) &&
      /(?:LABELS|MESSAGES|COPY|TITLES|DESCRIPTIONS)$/.test(node.name.text)) {
      for (const property of node.initializer.properties) {
        if (ts.isPropertyAssignment(property)) collectDisplayExpression(sourceFile, property.initializer);
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
      /(?:Label|Message|Status|Title|Description|Text)$/.test(node.name.text)) {
      collectFunctionReturns(node.initializer.body);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
      node.name && ts.isIdentifier(node.name) &&
      /(?:Label|Message|Status|Title|Description|Text)$/.test(node.name.text) && node.body) {
      collectFunctionReturns(node.body);
    }
    if (ts.isJsxText(node)) {
      addText(sourceFile, node, node.getText(sourceFile));
      return;
    }
    if (ts.isJsxAttribute(node) && node.initializer) {
      if (ts.isStringLiteralLike(node.initializer)) {
        addText(sourceFile, node, node.initializer.text);
      } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        collectDisplayExpression(sourceFile, node.initializer.expression);
      }
      return;
    }
    if (ts.isJsxExpression(node) && node.expression) {
      collectDisplayExpression(sourceFile, node.expression);
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (findings.length > 0) {
  process.stderr.write(
    "Technical or internal wording was found in caregiver-facing JSX. Replace it with plain language or document why the screen is not caregiver-facing.\n" +
    findings.map((item) => `- ${item.file}:${item.line}: [${item.term}] ${item.text}`).join("\n") +
    "\n",
  );
}
assert.equal(findings.length, 0, `${findings.length} caregiver-facing language issue(s) found across ${files.length} UI files.`);
process.stdout.write(`Caregiver language scan passed across ${files.length} UI files.\n`);
