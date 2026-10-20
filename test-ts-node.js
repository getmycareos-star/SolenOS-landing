const ts = require('typescript');

console.log("TypeScript required successfully");

const result = ts.transpileModule("const x: number = 5;", { compilerOptions: { module: ts.ModuleKind.ESNext } });
console.log("Transpilation result:", result.outputText);