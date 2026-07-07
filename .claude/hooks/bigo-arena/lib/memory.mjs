// Heuristic memory-risk scan: large fixed allocations and API routes
// that appear to return unbounded collections.
export function scanMemory(source, filePath) {
  const findings = [];

  source.split("\n").forEach((line, i) => {
    const bigAlloc = line.match(/(?:new Array\(|Buffer\.alloc\()\s*(\d+)/);
    if (bigAlloc && Number(bigAlloc[1]) > 1_000_000) {
      findings.push({
        category: "memory",
        severity: "medium",
        line: i + 1,
        message: `Large fixed allocation (${bigAlloc[1]}) — verify this scales with real input, not a hardcoded upper bound`,
      });
    }
  });

  const isApiRoute = /[\\/]api[\\/]/.test(filePath);
  if (isApiRoute && /\.json\(\s*\w+\s*\)/.test(source) && !/\.(slice|limit|take)\(/.test(source)) {
    findings.push({
      category: "memory",
      severity: "low",
      line: 1,
      message: "API route returns a collection with no visible slice/limit/take — check it is paginated for large datasets",
    });
  }

  return findings;
}
