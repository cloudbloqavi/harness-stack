/** Minimal, dependency-free console logging with consistent prefixes. */

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) =>
  useColor ? `[${code}m${s}[0m` : s;

export const log = {
  info: (msg: string) => console.log(`${c("36", "›")} ${msg}`),
  ok: (msg: string) => console.log(`${c("32", "✓")} ${msg}`),
  warn: (msg: string) => console.warn(`${c("33", "!")} ${msg}`),
  error: (msg: string) => console.error(`${c("31", "✗")} ${msg}`),
  step: (msg: string) => console.log(`\n${c("1", msg)}`),
  detail: (msg: string) => console.log(`  ${c("90", msg)}`),
};
