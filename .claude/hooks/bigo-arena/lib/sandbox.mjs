// Runs a candidate function in a fresh `node` subprocess so a hang or
// crash in generated/edited code can't take down the hook itself.
//
// This is NOT a full security sandbox (no filesystem/network isolation —
// the imported file can still make real network calls if invoked, which
// is exactly why classify.mjs excludes anything touching known I/O
// clients). What it does enforce, on every platform including Windows:
// - wall-clock timeout (execFile's `timeout` option)
// - V8 heap cap (--max-old-space-size), Node's cross-platform
//   approximation of a memory rlimit.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const HARNESS_PATH = fileURLToPath(new URL("./_harness.mjs", import.meta.url));

export class SandboxError extends Error {}
export class SandboxTimeoutError extends SandboxError {}
export class SandboxExecutionError extends SandboxError {}

export async function runBenchmark({
  targetPath,
  functionName,
  datasets,
  warmup = 1,
  repeats = 3,
  timeoutMs = 10000,
  memMb = 512,
}) {
  const jobPath = path.join(os.tmpdir(), `bigo-job-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(jobPath, JSON.stringify({ targetPath, functionName, datasets, warmup, repeats }));

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--experimental-strip-types", `--max-old-space-size=${memMb}`, HARNESS_PATH, jobPath],
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
    );

    const lastLine = stdout.trim().split("\n").pop();
    const parsed = JSON.parse(lastLine);
    if (parsed.error && (!parsed.results || parsed.results.length === 0)) {
      throw new SandboxExecutionError(parsed.error);
    }
    return parsed;
  } catch (err) {
    if (err instanceof SandboxError) throw err;
    if (err.killed || err.signal) {
      throw new SandboxTimeoutError(`Execution exceeded ${timeoutMs}ms wall-clock timeout.`);
    }
    throw new SandboxExecutionError(err.stderr?.toString().slice(-1000) || err.message);
  } finally {
    fs.unlinkSync(jobPath);
  }
}
