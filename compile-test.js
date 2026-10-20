const ts = require('typescript');
const fs = require('fs');
const path = require('path');

// Read the source file
const sourceFile = './src/lib/situation-entry/pipeline.ts';
const sourceCode = fs.readFileSync(sourceFile, 'utf8');

// Compiler options
const compilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ES2020,
  strict: true,
  esModuleInterop: true,
  sourceMap: false,
  outDir: './dist',
  rootDir: './src'
};

// Compile the file
const host = ts.createCompilerHost(compilerOptions);
const program = ts.createProgram([sourceFile], compilerOptions, host);
const emitResult = program.emit();

// Get diagnostics
const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

if (diagnostics.length > 0) {
  console.log("Errors:");
  diagnostics.forEach(function(diagnostic) {
    if (diagnostic.file) {
      var position = diagnostic.getLineAndCharacterPosition(diagnostic.start);
      var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.log(diagnostic.file.fileName + ' (' + (position.line + 1) + ',' + (position.character + 1) + '): ' + message);
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  });
} else {
  console.log("Compilation successful");
  
  // Check if emit was successful
  if (emitResult.emitSkipped) {
    console.log("Warning: Emission skipped despite no errors");
  } else {
    console.log("Emission successful");
  }
}