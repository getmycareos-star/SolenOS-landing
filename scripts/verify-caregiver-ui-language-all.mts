import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const roots = ["src/app", "src/components"];
const caregiverCopySources = [
  "src/lib/progressive-understanding/turn-copy.ts",
  "src/lib/caregiver-load-engine/burden-messages.ts",
  "src/lib/mvp-surface-area/continuity-home.ts",
  "src/lib/activation-system/contract-constants.ts",
  "src/lib/product-north-star/search-demand-redirect.ts",
  "src/lib/caregiver-response-composer/index.ts",
  "src/lib/care-memory-maturity/index.ts",
  "src/lib/response-intelligence/ai-product-language.ts",
  "src/lib/situation-entry/caregiver-facing-uncertainty.ts",
  "src/lib/situation-entry/caregiver-response-dto.ts",
  "src/lib/support-signal-system/message-templates.ts",
  "src/lib/mvp-workspace/caregiver-surface.ts",
];
const sharedLanguageHelpers = ["src/lib/caregiver-language.ts"];
const excludedPathParts = [
  "/api/",
  "/ops/",
  "/ops-devtools/",
  "/ops-clarity/",
  "/ui-runtime/",
  // Operational metrics are an authenticated internal screen, not a caregiver experience.
  "/metrics/",
];
// Exclude only components with no caregiver-route references: two legacy panels and the debug visualizer.
const excludedFiles = new Set([
  "src/components/EvidenceCompletenessPanel.tsx",
  "src/components/routine-moments/RoutineMomentLogger.tsx",
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
    if (!/\.(tsx|jsx|ts|js)$/.test(relative) || /\.(test|spec)\.(tsx|jsx|ts|js)$/.test(relative) || relative.endsWith(".d.ts")) continue;
    if (excludedFiles.has(relative)) continue;
    files.push(relative);
  }
}

for (const root of roots) collect(root);
for (const file of caregiverCopySources) {
  statSync(file);
  if (!files.includes(file)) files.push(file);
}
files.push(...sharedLanguageHelpers);

const forbidden = /\b(?:epistemic(?: status)?|provenance|reconciliation(?: review)?|assertions?|living care record|ai companion|ai doctor|care continuity|longitudinal(?: history)?|assessment coverage|source attribution|handoff history|schema|database|backend|frontend|endpoint|payload|telemetry|inference(?: pipeline)?|retrieval(?: result| pipeline)?|extraction(?: pipeline)?|lineage|pipeline|migration|idempotent|persistence layer|postgres(?:ql)?|sqlite|qwen|lcr|delta engine|open loops|diagnostic|metadata|audit trail|api|json|ocr|checksum|fingerprint|uuid|http|claim (?:assessment|provenance|candidate|id)|evidence (?:review|assessment|completeness|freshness|retrieval|payload|id|projection|lineage|pipeline|chain)|confidence (?:score|level|threshold)|(?:low|high) confidence|candidate projection|longitudinal|corroborat(?:e|ion|ed|ing)|triangulat(?:e|ion)|baseline comparison|technical (?:details|diagnostic|diagnostics|error)|data integrity|observation window|source id|ai interpretation|ai-generated|ai-assisted|anonymous session|care session|session token)\b/i;

const vocabularyExamples: Array<{ text: string; shouldFlag: boolean }> = [
  { text: "Your care assessment is scheduled for Tuesday.", shouldFlag: false },
  { text: "The notes provide evidence of a change.", shouldFlag: false },
  { text: "The insurer is still reviewing the claim.", shouldFlag: false },
  { text: "The evidence retrieval pipeline is incomplete.", shouldFlag: true },
  { text: "The confidence score is low.", shouldFlag: true },
  { text: "The backend payload is incomplete.", shouldFlag: true },
];
for (const example of vocabularyExamples) {
  assert.equal(forbidden.test(example.text), example.shouldFlag, `Unexpected caregiver vocabulary classification: ${example.text}`);
}

type Finding = { file: string; line: number; text: string; term: string };
const findings: Finding[] = [];
const syntaxErrors: string[] = [];

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
  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property)) collectDisplayExpression(sourceFile, property.initializer);
    }
    return;
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) collectDisplayExpression(sourceFile, element);
    return;
  }
  if (ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) {
    collectDisplayExpression(sourceFile, node.expression);
    if (ts.isElementAccessExpression(node) && node.argumentExpression) {
      collectDisplayExpression(sourceFile, node.argumentExpression);
    }
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
  if (sourceFile.parseDiagnostics.length > 0) {
    const diagnostics = sourceFile.parseDiagnostics.map((diagnostic) => {
      const position = diagnostic.start === undefined
        ? { line: 0, character: 0 }
        : sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
      return `- ${file}:${position.line + 1}:${position.character + 1}: ${message}`;
    });
    syntaxErrors.push(...diagnostics);
    continue;
  }

  function collectFunctionReturns(node: ts.Node): void {
    if (ts.isReturnStatement(node) && node.expression) {
      collectDisplayExpression(sourceFile, node.expression);
      return;
    }
    ts.forEachChild(node, collectFunctionReturns);
  }

  function isInsideNonCopyElement(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
        const tag = current.openingElement.tagName.getText(sourceFile).toLowerCase();
        if (tag === "style" || tag === "script") return true;
      }
      current = current.parent;
    }
    return false;
  }

  const caregiverTextAttributes = new Set([
    "alt", "aria-description", "aria-label", "aria-placeholder", "aria-roledescription",
    "aria-valuetext", "caption", "confirmtext", "description", "emptylabel", "errormessage",
    "helpertext", "label", "loadingtext", "message", "placeholder", "statusmessage",
    "submittext", "title", "tooltip",
  ]);

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
      !/(?:FORBIDDEN|BANNED)/i.test(node.name.text) &&
      /(?:LABEL|MESSAGE|COPY|TITLE|DESCRIPTION|ACKNOWLEDGEMENT|REFUSAL|PROMPT|QUESTION)/i.test(node.name.text) &&
      (ts.isObjectLiteralExpression(node.initializer) || ts.isArrayLiteralExpression(node.initializer) || ts.isStringLiteralLike(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
      collectDisplayExpression(sourceFile, node.initializer);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
      /(?:Label|Message|Messages|Status|Title|Description|Text|Copy|Response|Summary|Recognition|Confirmation|Acknowledgement|Redirect|View|Behavior|Progress|MetaLabel|WhatChanged|OrientationLines)$/.test(node.name.text)) {
      if (ts.isBlock(node.initializer.body)) collectFunctionReturns(node.initializer.body);
      else collectDisplayExpression(sourceFile, node.initializer.body);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
      node.name && ts.isIdentifier(node.name) &&
      /(?:Label|Message|Messages|Status|Title|Description|Text|Copy|Response|Summary|Recognition|Confirmation|Acknowledgement|Redirect|View|Behavior|Progress|MetaLabel|WhatChanged|OrientationLines)$/.test(node.name.text) && node.body) {
      collectFunctionReturns(node.body);
    }
    if (ts.isJsxText(node)) {
      if (!isInsideNonCopyElement(node)) addText(sourceFile, node, node.getText(sourceFile));
      return;
    }
    if (ts.isJsxAttribute(node) && node.initializer) {
      const attributeName = node.name.getText(sourceFile).toLowerCase();
      if (caregiverTextAttributes.has(attributeName)) {
        if (ts.isStringLiteralLike(node.initializer)) {
          addText(sourceFile, node, node.initializer.text);
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          collectDisplayExpression(sourceFile, node.initializer.expression);
        }
      }
      return;
    }
    if (ts.isJsxExpression(node) && node.expression) {
      if (!isInsideNonCopyElement(node)) collectDisplayExpression(sourceFile, node.expression);
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (syntaxErrors.length > 0) {
  process.stderr.write("Caregiver language scan could not safely inspect files with syntax errors:\n" + syntaxErrors.join("\n") + "\n");
}
assert.equal(syntaxErrors.length, 0, `${syntaxErrors.length} caregiver-facing source file(s) could not be parsed.`);

if (findings.length > 0) {
  process.stderr.write(
    "Technical or internal wording was found in caregiver-facing JSX. Replace it with plain language or document why the screen is not caregiver-facing.\n" +
    findings.map((item) => `- ${item.file}:${item.line}: [${item.term}] ${item.text}`).join("\n") +
    "\n",
  );
}
assert.equal(findings.length, 0, `${findings.length} caregiver-facing language issue(s) found across ${files.length} UI files.`);
process.stdout.write(`Caregiver language scan passed across ${files.length} UI files.\n`);
