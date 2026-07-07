// Same calibration as the Python arena (analysis/cost_simulator.py):
// 15ms average latency at 100M requests/month lands near $812/month.
// This simulates "what would this cost at that scale," not the cost of
// this one run — see the printed caption in report.mjs.
export const COST_PER_MS_PER_REQUEST = 812 / (15 * 100_000_000);
export const DEFAULT_MONTHLY_REQUESTS = 100_000_000;

export function simulateCost(avgLatencyMs, monthlyRequests = DEFAULT_MONTHLY_REQUESTS) {
  const monthlyUsd = avgLatencyMs * monthlyRequests * COST_PER_MS_PER_REQUEST;
  const infraTier = monthlyUsd < 100 ? "Small VM" : monthlyUsd < 2000 ? "Auto Scaling" : "Kubernetes Cluster";
  return {
    monthlyUsd: Math.round(monthlyUsd * 100) / 100,
    avgLatencyMs,
    infraTier,
    monthlyRequests,
  };
}

const ENERGY_ORDER = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n^2)", "O(n^3)", "Exponential"];

// Energy is derived from the complexity class, not measured directly —
// there is no per-process power meter available here. It is a proxy:
// worse asymptotic complexity means more CPU cycles per request at scale.
export function estimateEnergyLabel(complexityLabel) {
  const idx = ENERGY_ORDER.indexOf(complexityLabel);
  if (idx < 0) return "Unknown";
  if (idx <= 1) return "Low";
  if (idx <= 3) return "Medium";
  if (idx === 4) return "High";
  return "Severe";
}
