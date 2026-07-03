/**
 * Consent gating.
 *
 * Harness never writes to `.subagents/`, installs tooling, or invokes a skill
 * without developer consent. This module centralises the prompt and the
 * persisted "always for this project" memory so the same decision is not
 * re-asked (spec R2, R9).
 */
import readline from "node:readline/promises";
import path from "node:path";
import { promises as fs } from "node:fs";
import { pathExists, ensureDir } from "./fsx.js";

export type ConsentAnswer = "yes" | "no" | "always";

export interface ConsentOptions {
  /** Assume "yes" for everything (non-interactive / CI). */
  assumeYes?: boolean;
  /** Project root, used to locate the persisted consent store. */
  projectRoot?: string;
}

interface ConsentStore {
  /** Keys that the developer approved with "always for this project". */
  always: string[];
  /** Keys explicitly declined; parked, not re-prompted. */
  declined: string[];
}

function storePath(root: string): string {
  return path.join(root, ".harness", "consent.json");
}

async function loadStore(root: string): Promise<ConsentStore> {
  const file = storePath(root);
  if (!(await pathExists(file))) return { always: [], declined: [] };
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return {
      always: Array.isArray(parsed.always) ? parsed.always : [],
      declined: Array.isArray(parsed.declined) ? parsed.declined : [],
    };
  } catch {
    return { always: [], declined: [] };
  }
}

async function saveStore(root: string, store: ConsentStore): Promise<void> {
  const file = storePath(root);
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(store, null, 2) + "\n", "utf8");
}

/**
 * Ask for consent. `key` identifies the decision so "always"/"declined" can be
 * remembered. Pass `allowAlways: false` for one-off prompts (plain y/n).
 */
export async function confirm(
  question: string,
  opts: ConsentOptions & { key?: string; allowAlways?: boolean } = {},
): Promise<ConsentAnswer> {
  const root = opts.projectRoot ?? process.cwd();
  const key = opts.key;
  const allowAlways = opts.allowAlways ?? Boolean(key);

  if (key) {
    const store = await loadStore(root);
    if (store.always.includes(key)) return "always";
    if (store.declined.includes(key)) return "no";
  }

  if (opts.assumeYes) return "yes";
  if (!process.stdin.isTTY) {
    // Non-interactive without --yes: default to declining writes safely.
    return "no";
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const suffix = allowAlways ? "(y / n / always)" : "(y / n)";
    const raw = (await rl.question(`${question} ${suffix} `))
      .trim()
      .toLowerCase();
    const answer: ConsentAnswer =
      raw === "a" || raw === "always"
        ? allowAlways
          ? "always"
          : "yes"
        : raw === "y" || raw === "yes"
          ? "yes"
          : "no";

    if (key) {
      const store = await loadStore(root);
      if (answer === "always" && !store.always.includes(key)) {
        store.always.push(key);
        await saveStore(root, store);
      } else if (answer === "no" && !store.declined.includes(key)) {
        store.declined.push(key);
        await saveStore(root, store);
      }
    }
    return answer;
  } finally {
    rl.close();
  }
}

export function isApproved(answer: ConsentAnswer): boolean {
  return answer === "yes" || answer === "always";
}
