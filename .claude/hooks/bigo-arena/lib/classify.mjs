// Decides whether a parsed function is safe/meaningful to benchmark
// dynamically (pure-ish, single array-shaped input, no I/O) versus one
// that only gets a static review (components, route handlers, anything
// touching network/DB clients).

const IO_IDENTIFIERS = [
  "fetch",
  "notion",
  "Notion",
  "prisma",
  "Prisma",
  "supabase",
  "axios",
  "openai",
  "OpenAI",
  "anthropic",
  "Anthropic",
  "mcp",
  "MCP",
  "fs.",
  "readFile",
  "writeFile",
  "process.env",
  "localStorage",
  "sessionStorage",
  "document.",
  "window.",
];

const ARRAY_TYPE_RE = /(\[\])|Array\s*</;

function looksLikeArrayParam(param) {
  if (param.defaultIsScalarLiteral) return false; // e.g. `message = "..."` infers a scalar, not an array
  if (!param.typeText) return true; // genuinely untyped/any: assume benchmarkable, generic synthetic input
  return ARRAY_TYPE_RE.test(param.typeText);
}

function referencesIO(bodyText) {
  return IO_IDENTIFIERS.some((needle) => bodyText.includes(needle));
}

function looksLikeJSX(bodyText) {
  return /<[A-Z][\w.]*[\s/>]/.test(bodyText) || /return\s*\(\s*</.test(bodyText);
}

export function classifyFunction(fn) {
  const reasons = [];

  if (fn.isAsync) reasons.push("async function (likely I/O-bound, not a pure CPU benchmark)");
  if (fn.params.length !== 1) reasons.push(`expects ${fn.params.length} parameters (benchmark harness needs exactly 1)`);
  if (fn.params.length === 1 && !looksLikeArrayParam(fn.params[0])) {
    reasons.push(`parameter type '${fn.params[0].typeText}' does not look array-shaped`);
  }
  if (referencesIO(fn.bodyText)) reasons.push("references network/DB/storage APIs");
  if (looksLikeJSX(fn.bodyText)) reasons.push("appears to return JSX (React component)");

  return {
    benchmarkable: reasons.length === 0,
    reasons,
  };
}
