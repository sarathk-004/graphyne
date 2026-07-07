// Line-based heuristic scan. Not a substitute for a real SAST tool —
// catches the obvious/common patterns worth flagging on every save.
const PATTERNS = [
  { re: /\beval\s*\(/, message: "Use of eval() enables arbitrary code execution", severity: "high" },
  { re: /new\s+Function\s*\(/, message: "Function() constructor is equivalent to eval()", severity: "high" },
  {
    re: /dangerouslySetInnerHTML/,
    message: "dangerouslySetInnerHTML bypasses React's XSS protection — ensure content is sanitized",
    severity: "medium",
  },
  {
    re: /(sk-[A-Za-z0-9]{16,}|["']Bearer\s+[A-Za-z0-9._-]{20,}["'])/,
    message: "Possible hardcoded secret/API key/token literal",
    severity: "high",
  },
  {
    re: /\bexec(?:Sync)?\s*\(|child_process/,
    message: "Shell execution — verify inputs are not attacker-controlled (command injection risk)",
    severity: "high",
  },
  {
    re: /process\.env\.\w+\s*\|\|\s*["'][^"']+["']/,
    message: "Environment variable has a hardcoded fallback value — check it isn't a real secret",
    severity: "low",
  },
];

export function scanSecurity(source) {
  const findings = [];
  source.split("\n").forEach((line, i) => {
    for (const pattern of PATTERNS) {
      if (pattern.re.test(line)) {
        findings.push({ category: "security", severity: pattern.severity, line: i + 1, message: pattern.message });
      }
    }
  });
  return findings;
}
