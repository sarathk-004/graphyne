// Executed as a fresh `node` subprocess by sandbox.mjs. Imports the real
// target file (so it has access to its own helper functions/imports),
// times the named export against each supplied dataset, and prints JSON
// results to stdout. Never throws past this file — errors are reported
// as JSON so the parent process doesn't have to parse stderr.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
}

async function main() {
  const jobPath = process.argv[2];
  const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));

  let mod;
  try {
    mod = await import(pathToFileURL(job.targetPath).href);
  } catch (err) {
    console.log(JSON.stringify({ results: [], error: `import failed: ${err.message}` }));
    return;
  }

  const fn = mod[job.functionName];
  if (typeof fn !== "function") {
    console.log(JSON.stringify({ results: [], error: `export '${job.functionName}' is not a function` }));
    return;
  }

  const results = [];
  for (const { n, dataset } of job.datasets) {
    try {
      for (let i = 0; i < job.warmup; i++) fn(dataset);
      const samples = [];
      for (let i = 0; i < job.repeats; i++) {
        const start = performance.now();
        fn(dataset);
        samples.push(performance.now() - start);
      }
      results.push({ n, medianMs: median(samples), meanMs: mean(samples), stdevMs: stdev(samples) });
    } catch (err) {
      console.log(JSON.stringify({ results, error: `runtime error at n=${n}: ${err.message}` }));
      return;
    }
  }

  console.log(JSON.stringify({ results }));
}

main();
