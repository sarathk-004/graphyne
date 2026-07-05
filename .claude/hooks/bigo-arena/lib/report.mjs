import path from "node:path";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

const SEVERITY_STYLE = {
  high: { mark: "HIGH", color: RED },
  medium: { mark: "MED ", color: YELLOW },
  low: { mark: "LOW ", color: DIM },
};
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function scoreColor(score) {
  if (score >= 80) return GREEN;
  if (score >= 50) return YELLOW;
  return RED;
}

function pad(str, width) {
  str = String(str);
  return str + " ".repeat(Math.max(0, width - str.length));
}

function renderScoreTable(overall, categories) {
  const cols = [
    { label: "Category", width: 14 },
    { label: "Score", width: 8 },
    { label: "Findings", width: 9 },
  ];
  const totalWidth = cols.reduce((a, c) => a + c.width + 1, 0) + 1;
  const lines = [];

  lines.push("  " + "─".repeat(totalWidth));
  lines.push(
    "  │" + cols.map((c) => BOLD + pad(c.label, c.width) + RESET).join("│") + "│"
  );
  lines.push("  " + "─".repeat(totalWidth));
  for (const [name, cat] of Object.entries(categories)) {
    const color = scoreColor(cat.score);
    lines.push(
      "  │" +
        pad(name, cols[0].width) +
        "│" +
        color + pad(`${cat.score}/100`, cols[1].width) + RESET +
        "│" +
        pad(cat.findings.length, cols[2].width) +
        "│"
    );
  }
  lines.push("  " + "─".repeat(totalWidth));
  return lines.join("\n");
}

function summarizeSkipped(skippedFns) {
  const reasonCounts = new Map();
  for (const fn of skippedFns) {
    // Bucket by the first (primary) reason to avoid double counting
    // functions with multiple overlapping reasons.
    const primary = fn.reasons[0] || "unknown";
    let bucket = primary;
    if (/async function/.test(primary)) bucket = "async / I/O-bound";
    else if (/does not look array-shaped/.test(primary)) bucket = "parameter isn't array-shaped";
    else if (/expects \d+ parameters/.test(primary)) bucket = "wrong parameter count (needs exactly 1)";
    else if (/JSX/.test(primary)) bucket = "looks like a React component";
    else if (/network\/DB\/storage/.test(primary)) bucket = "touches network/DB/storage APIs";
    reasonCounts.set(bucket, (reasonCounts.get(bucket) || 0) + 1);
  }
  return [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]);
}

export function renderReport({ filePath, benchmarkResults, scoreResult, monthlyRequests }) {
  const rel = path.basename(filePath);
  const lines = [];

  lines.push("");
  lines.push(`${BOLD}${CYAN}  BIG-O ARENA — ${rel}${RESET}`);
  const overallColor = scoreColor(scoreResult.overall);
  lines.push(`  Overall design score: ${overallColor}${BOLD}${scoreResult.overall}/100${RESET}`);
  lines.push("");

  const categories = Object.entries(scoreResult.categories);
  if (categories.length > 0) {
    lines.push(renderScoreTable(scoreResult.overall, scoreResult.categories));
    lines.push("");
  }

  const benchmarked = benchmarkResults.filter((b) => !b.skipped && !b.error);
  const errored = benchmarkResults.filter((b) => !b.skipped && b.error);
  const skipped = benchmarkResults.filter((b) => b.skipped);

  lines.push(`${BOLD}  PERFORMANCE${RESET}`);
  lines.push(
    `${DIM}  ${benchmarkResults.length} functions found — ${benchmarked.length} benchmarked, ` +
      `${errored.length} errored, ${skipped.length} skipped${RESET}`
  );
  if (benchmarked.length > 0) {
    for (const b of benchmarked) {
      const status = b.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
      lines.push(
        `    ${status} ${b.name}: ${b.estimated} (slope ${b.slope.toFixed(2)}), energy ${b.energy}, ` +
          `simulated cost $${b.cost.monthlyUsd.toLocaleString()}/mo @ ${monthlyRequests.toLocaleString()} req/mo`
      );
    }
  }
  if (skipped.length > 0) {
    lines.push(`${DIM}  Skipped, by reason:${RESET}`);
    for (const [reason, count] of summarizeSkipped(skipped)) {
      lines.push(`${DIM}    ${count.toString().padStart(3)}x  ${reason}${RESET}`);
    }
  }
  lines.push("");

  const findingCategories = categories.filter(([, cat]) => cat.findings.length > 0);
  if (findingCategories.length === 0) {
    lines.push(`${GREEN}  No static findings.${RESET}`);
  } else {
    for (const [name, cat] of findingCategories) {
      lines.push(`${BOLD}  ${name.toUpperCase()}${RESET}`);
      const sorted = [...cat.findings].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
      );
      for (const f of sorted) {
        const style = SEVERITY_STYLE[f.severity] ?? { mark: "INFO", color: RESET };
        lines.push(`    ${style.color}[${style.mark}]${RESET} line ${f.line}: ${f.message}`);
      }
      lines.push("");
    }
  }

  lines.push(
    `${DIM}  Cost/energy are simulated at an assumed request volume, not measured. Performance benchmarks only ` +
      `ran for functions with a single array-shaped parameter and no I/O.${RESET}`
  );
  lines.push("");

  return lines.join("\n");
}
