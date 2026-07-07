// Log-log linear regression -> Big-O classification. Same model as the
// Python arena's analysis/complexity.py, ported so both tools agree on
// what "O(n^2)" means.

const BANDS = [
  [0.15, "O(1)"],
  [0.6, "O(log n)"],
  [1.15, "O(n)"],
  [1.6, "O(n log n)"],
  [2.5, "O(n^2)"],
  [3.5, "O(n^3)"],
];

export function classifySlope(slope) {
  for (const [threshold, label] of BANDS) {
    if (slope < threshold) return label;
  }
  return "Exponential";
}

function linearRegression(xs, ys) {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let ssXY = 0;
  let ssXX = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (xs[i] - meanX) * (ys[i] - meanY);
    ssXX += (xs[i] - meanX) ** 2;
  }
  const slope = ssXX ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;

  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (ys[i] - meanY) ** 2;
    ssRes += (ys[i] - (slope * xs[i] + intercept)) ** 2;
  }
  const r2 = ssTot ? 1 - ssRes / ssTot : 1;
  return { slope, intercept, r2 };
}

export function estimateComplexity(timings) {
  if (timings.length < 2) {
    throw new Error("At least two timing points are required to estimate complexity.");
  }
  const xs = timings.map((t) => Math.log(t.n));
  const ys = timings.map((t) => Math.log(Math.max(t.medianMs, 1e-6)));
  const { slope, r2 } = linearRegression(xs, ys);
  const confidence = Math.max(0, Math.min(1, r2));
  return { slope, estimated: classifySlope(slope), confidence };
}
