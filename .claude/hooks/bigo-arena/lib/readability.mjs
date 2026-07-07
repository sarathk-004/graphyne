// Cyclomatic-complexity approximation, function length, nesting depth,
// and overall file size — cheap proxies for "how hard is this to read."
function countDecisionPoints(text) {
  const matches = text.match(/\b(if|else if|for|while|case|catch)\b|&&|\|\|/g);
  return 1 + (matches ? matches.length : 0);
}

function maxNestingDepth(text) {
  let depth = 0;
  let max = 0;
  for (const ch of text) {
    if (ch === "{") {
      depth++;
      max = Math.max(max, depth);
    } else if (ch === "}") {
      depth--;
    }
  }
  return max;
}

export function scanReadability(functions, source) {
  const findings = [];

  for (const fn of functions) {
    const complexity = countDecisionPoints(fn.bodyText);
    const lengthLines = fn.endLine - fn.startLine + 1;
    const nesting = maxNestingDepth(fn.bodyText);

    if (complexity > 10) {
      findings.push({
        category: "readability",
        severity: "medium",
        line: fn.startLine,
        message: `${fn.name}: cyclomatic complexity ~${complexity} (consider splitting)`,
      });
    }
    if (lengthLines > 60) {
      findings.push({
        category: "readability",
        severity: "low",
        line: fn.startLine,
        message: `${fn.name}: ${lengthLines} lines long (consider extracting helpers)`,
      });
    }
    if (nesting > 4) {
      findings.push({
        category: "readability",
        severity: "medium",
        line: fn.startLine,
        message: `${fn.name}: nesting depth ${nesting} (hard to follow, consider early returns)`,
      });
    }
  }

  const fileLines = source.split("\n").length;
  if (fileLines > 400) {
    findings.push({
      category: "readability",
      severity: "low",
      line: 1,
      message: `File is ${fileLines} lines long — consider splitting into smaller modules`,
    });
  }

  return findings;
}
