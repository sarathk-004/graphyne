#!/usr/bin/env node
// Entrypoint invoked by the PostToolUse hook (see ../settings.json) after
// every Write/Edit. Reads the hook's JSON payload from stdin, analyzes
// the changed file, and prints a report to stdout. Never throws past
// main() and never exits non-zero for an analysis-side problem — this
// must not be able to break the user's actual file edit.
import fs from "node:fs";
import path from "node:path";
import { parseFunctions } from "./lib/parse.mjs";
import { classifyFunction } from "./lib/classify.mjs";
import { generateArrayInput } from "./lib/datasetgen.mjs";
import { runBenchmark, SandboxError } from "./lib/sandbox.mjs";
import { estimateComplexity } from "./lib/complexity.mjs";
import { simulateCost, estimateEnergyLabel, DEFAULT_MONTHLY_REQUESTS } from "./lib/cost.mjs";
import { scanSecurity } from "./lib/security.mjs";
import { scanDbQueries } from "./lib/dbqueries.mjs";
import { scanMemory } from "./lib/memory.mjs";
import { scanReadability } from "./lib/readability.mjs";
import { computeScore } from "./lib/score.mjs";
import { renderReport } from "./lib/report.mjs";

const SLOPE_PASS_THRESHOLD = 1.15;
const BENCHMARK_SIZES = [500, 1000, 2000, 4000];
const SKIP_DIR_RE = /[\\/](node_modules|\.next|dist|build|\.git)[\\/]/;

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

async function extractFilePath() {
  // CLI usage (`node analyze.mjs <path>`) takes priority and must never
  // block on stdin - only the PostToolUse hook invocation (no argv,
  // JSON payload piped on stdin) needs to read stdin at all. Reading
  // stdin unconditionally hung indefinitely when run from a plain
  // script/non-interactive shell with no argv and no piped input,
  // since `end` never fires without EOF.
  if (process.argv[2]) {
    return process.argv[2];
  }

  const raw = await readStdin();
  if (raw) {
    try {
      const payload = JSON.parse(raw);
      const fp = payload?.tool_input?.file_path || payload?.tool_input?.path;
      if (fp) return fp;
    } catch {
      // fall through to argv
    }
  }
  return process.argv[2] || null;
}

async function benchmarkFunction(fn, filePath) {
  const classification = classifyFunction(fn);
  if (!classification.benchmarkable) {
    return { name: fn.name, startLine: fn.startLine, skipped: true, reasons: classification.reasons };
  }

  const datasets = BENCHMARK_SIZES.map((n) => ({ n, dataset: generateArrayInput(n) }));

  try {
    const { results, error } = await runBenchmark({
      targetPath: filePath,
      functionName: fn.name,
      datasets,
      warmup: 1,
      repeats: 3,
      timeoutMs: 10000,
      memMb: 512,
    });

    if (error || results.length < 2) {
      return { name: fn.name, startLine: fn.startLine, skipped: false, error: error || "not enough data points" };
    }

    const timings = results.map((r) => ({ n: r.n, medianMs: r.medianMs }));
    const complexity = estimateComplexity(timings);
    const passed = complexity.slope <= SLOPE_PASS_THRESHOLD;
    const cost = simulateCost(results[results.length - 1].medianMs, DEFAULT_MONTHLY_REQUESTS);
    const energy = estimateEnergyLabel(complexity.estimated);

    return {
      name: fn.name,
      startLine: fn.startLine,
      skipped: false,
      passed,
      slope: complexity.slope,
      estimated: complexity.estimated,
      confidence: complexity.confidence,
      cost,
      energy,
    };
  } catch (err) {
    if (err instanceof SandboxError) {
      return { name: fn.name, startLine: fn.startLine, skipped: false, error: err.message };
    }
    throw err;
  }
}

async function main() {
  const filePath = await extractFilePath();
  if (!filePath) return;
  if (!/\.tsx?$/.test(filePath)) return;
  if (SKIP_DIR_RE.test(filePath)) return;
  if (!fs.existsSync(filePath)) return;

  let parsed;
  try {
    parsed = parseFunctions(filePath);
  } catch (err) {
    console.log(`Big-O Arena: could not parse ${path.basename(filePath)} (${err.message})`);
    return;
  }

  const { source, sourceFile, functions } = parsed;
  if (functions.length === 0) return;

  const benchmarkResults = [];
  for (const fn of functions) {
    try {
      benchmarkResults.push(await benchmarkFunction(fn, filePath));
    } catch (err) {
      benchmarkResults.push({ name: fn.name, startLine: fn.startLine, skipped: false, error: err.message });
    }
  }

  const findings = [
    ...scanSecurity(source),
    ...scanDbQueries(sourceFile),
    ...scanMemory(source, filePath),
    ...scanReadability(functions, source),
  ];

  const scoreResult = computeScore({ findings, benchmarkResults });
  console.log(renderReport({ filePath, benchmarkResults, scoreResult, monthlyRequests: DEFAULT_MONTHLY_REQUESTS }));
}

main().catch((err) => {
  console.log(`Big-O Arena: analysis failed unexpectedly (${err.message})`);
});
