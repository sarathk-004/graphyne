// AST-based N+1 detector: flags an `await <network/DB client call>`
// found inside a for-of loop or array-iteration callback (.map/.forEach/
// .filter/.reduce) — the classic "one query per already-fetched row"
// pattern. Deliberately excludes plain for/while/do-while: those are
// just as often a legitimate cursor-pagination loop ("keep fetching
// pages until cursor is null"), which is not the anti-pattern and would
// otherwise dominate this scanner with false positives.
import ts from "typescript";

const CLIENT_PATTERN = /(notion|prisma|supabase|axios|fetch\(|db\.|\.query\(|\.collection\(|findMany|findUnique|findFirst)/i;

function isLoopNode(node) {
  return ts.isForOfStatement(node);
}

function isArrayIterationCallback(node) {
  if (!ts.isCallExpression(node)) return false;
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  return ["map", "forEach", "filter", "reduce"].includes(node.expression.name.text);
}

function containsAwaitOnClient(node) {
  let found = false;
  function walk(n) {
    if (found) return;
    if (ts.isAwaitExpression(n) && CLIENT_PATTERN.test(n.getText())) {
      found = true;
      return;
    }
    ts.forEachChild(n, walk);
  }
  walk(node);
  return found;
}

export function scanDbQueries(sourceFile) {
  const findings = [];

  function visit(node) {
    if ((isLoopNode(node) || isArrayIterationCallback(node)) && containsAwaitOnClient(node)) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      findings.push({
        category: "db",
        severity: "high",
        line,
        message: "Await on a network/DB client call inside a loop — likely N+1 query pattern",
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}
