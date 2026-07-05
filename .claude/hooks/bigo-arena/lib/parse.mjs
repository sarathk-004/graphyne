// Parses a .ts/.tsx file with the TypeScript compiler API and extracts
// top-level functions (function declarations and const arrow functions).
import ts from "typescript";
import fs from "node:fs";

export function parseFunctions(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const functions = [];

  function paramInfo(params) {
    return params.map((p) => ({
      name: p.name.getText(sourceFile),
      typeText: p.type ? p.type.getText(sourceFile) : null,
      defaultIsScalarLiteral:
        !!p.initializer &&
        (ts.isStringLiteral(p.initializer) ||
          ts.isNumericLiteral(p.initializer) ||
          p.initializer.kind === ts.SyntaxKind.TrueKeyword ||
          p.initializer.kind === ts.SyntaxKind.FalseKeyword),
    }));
  }

  function pushFunction(name, node, params, isAsync, isExported) {
    const start = node.getStart(sourceFile);
    const end = node.getEnd();
    functions.push({
      name,
      params: paramInfo(params),
      isAsync,
      isExported,
      bodyText: node.getText(sourceFile),
      startLine: sourceFile.getLineAndCharacterOfPosition(start).line + 1,
      endLine: sourceFile.getLineAndCharacterOfPosition(end).line + 1,
    });
  }

  function isExportedModifier(node) {
    return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      pushFunction(
        node.name.text,
        node,
        node.parameters,
        !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
        isExportedModifier(node)
      );
    } else if (ts.isVariableStatement(node)) {
      const exported = isExportedModifier(node);
      for (const decl of node.declarationList.declarations) {
        if (
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) &&
          ts.isIdentifier(decl.name)
        ) {
          const fn = decl.initializer;
          pushFunction(
            decl.name.text,
            node,
            fn.parameters,
            !!fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
            exported
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { source, sourceFile, functions };
}
