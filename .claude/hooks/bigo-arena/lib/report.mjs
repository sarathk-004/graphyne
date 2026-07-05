import path from "node:path";

function severityMark(severity) {
  return { high: "[HIGH]", medium: "[MED] ", low: "[LOW] " }[severity] ?? "[INFO]";
}

export function renderReport({ filePath, benchmarkResults, scoreResult, monthlyRequests }) {
  const lines = [];
  const rel = path.basename(filePath);

  lines.push("");
  lines.push(`Big-O Arena — ${rel}`);
  lines.push(`Overall design score: ${scoreResult.overall}/100`);
  lines.push("");

  if (benchmarkResults.length) {
    lines.push("Performance (dynamic benchmark):");
    for (const b of benchmarkResults) {
      if (b.skipped) {
        lines.push(`  - ${b.name}: not benchmarked (${b.reasons.join("; ")})`);
        continue;
      }
      if (b.error) {
        lines.push(`  - ${b.name}: benchmark failed (${b.error})`);
        continue;
      }
      const status = b.passed ? "PASS" : "FAIL";
      lines.push(
        `  - ${b.name}: ${status} — ${b.estimated} (slope ${b.slope.toFixed(2)}), ` +
          `energy ${b.energy}, simulated cost $${b.cost.monthlyUsd.toLocaleString()}/mo ` +
          `@ ${monthlyRequests.toLocaleString()} req/mo`
      );
    }
    lines.push("");
  }

  const categories = Object.entries(scoreResult.categories);
  if (categories.length === 0) {
    lines.push("No static findings.");
  } else {
    for (const [name, cat] of categories) {
      lines.push(`${name} (${cat.score}/100):`);
      for (const f of cat.findings) {
        lines.push(`  ${severityMark(f.severity)} line ${f.line}: ${f.message}`);
      }
    }
  }

  lines.push("");
  lines.push(
    "Note: cost/energy are simulated at an assumed request volume, not measured. " +
      "Performance benchmarks only ran for functions with a single array-shaped parameter and no I/O."
  );

  return lines.join("\n");
}
