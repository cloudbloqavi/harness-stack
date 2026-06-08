/**
 * Interactive agentic-platform selection for `harness init`.
 *
 * The whole framework is platform-agnostic, so the first init decision is:
 * which agentic environment are you using? We ask (consent-gated) rather than
 * silently defaulting, then resolve models, capabilities, and event hooks for
 * that platform.
 */
import readline from "node:readline/promises";
import { listAdapters } from "../adapters/registry.js";
import { log } from "../util/log.js";

export interface SelectPlatformOptions {
  /** Pre-chosen platform (e.g. --platform / HARNESS_PLATFORM). Skips the prompt. */
  preselected?: string;
  /** Non-interactive default when there's no TTY and nothing preselected. */
  fallback?: string;
}

export async function selectPlatform(
  opts: SelectPlatformOptions = {},
): Promise<string> {
  const adapters = listAdapters();
  const ids = adapters.map((a) => a.id);

  if (opts.preselected) {
    if (!ids.includes(opts.preselected)) {
      throw new Error(
        `Unknown platform "${opts.preselected}". Known: ${ids.join(", ")}.`,
      );
    }
    return opts.preselected;
  }

  const fallback = opts.fallback ?? ids[0]!;
  if (!process.stdin.isTTY) return fallback;

  log.step("Which agentic coding platform are you using?");
  adapters.forEach((a, i) => log.info(`  ${i + 1}) ${a.displayName} (${a.id})`));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const raw = (await rl.question(`Select [1-${adapters.length}] (default 1): `))
      .trim();
    if (raw === "") return adapters[0]!.id;
    const byNum = Number(raw);
    if (Number.isInteger(byNum) && byNum >= 1 && byNum <= adapters.length) {
      return adapters[byNum - 1]!.id;
    }
    const byId = ids.find((id) => id === raw.toLowerCase());
    if (byId) return byId;
    log.warn(`Unrecognised choice "${raw}"; using ${adapters[0]!.displayName}.`);
    return adapters[0]!.id;
  } finally {
    rl.close();
  }
}
