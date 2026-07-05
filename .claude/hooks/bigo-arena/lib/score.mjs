// Combines static findings + dynamic benchmark results into a
// deterministic 0-100 score per category and an overall average.
// Deliberately rule-based (not an LLM's subjective read) so the same
// file always scores the same way.
const SEVERITY_PENALTY = { high: 15, medium: 7, low: 3 };

export function computeScore({ findings, benchmarkResults }) {
  const categories = {};
  const ensure = (cat) => {
    if (!categories[cat]) categories[cat] = { score: 100, findings: [] };
    return categories[cat];
  };

  for (const f of findings) {
    const cat = ensure(f.category);
    cat.score -= SEVERITY_PENALTY[f.severity] ?? 5;
    cat.findings.push(f);
  }

  const perf = ensure("performance");
  for (const b of benchmarkResults) {
    if (b.skipped || b.error) continue;
    if (!b.passed) {
      perf.score -= 20;
      perf.findings.push({
        category: "performance",
        severity: "high",
        line: b.startLine,
        message: `${b.name}: estimated ${b.estimated} (slope ${b.slope.toFixed(2)}) exceeds target complexity`,
      });
    }
  }

  for (const cat of Object.values(categories)) {
    cat.score = Math.max(0, Math.min(100, cat.score));
  }

  const scores = Object.values(categories).map((c) => c.score);
  const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;

  return { overall, categories };
}
