/**
 * Superpowers foundation installer (spec R8).
 *
 * Superpowers (obra/superpowers, MIT) is the execution-discipline layer:
 * RED-GREEN-REFACTOR TDD, contracts, two-stage review. Support varies by
 * platform — strongest on Claude Code, repo-install on Codex/Gemini, known
 * clashes on OpenCode. Init installs the compatible subset or skips with a
 * clear note; it NEVER fails the init over Superpowers.
 */
import { run } from "./exec.js";

export type SuperpowersSupport = "full" | "subset" | "skip";

export interface PlatformSupport {
  level: SuperpowersSupport;
  note: string;
}

export function supportFor(platform: string): PlatformSupport {
  switch (platform) {
    case "claude-code":
      return {
        level: "full",
        note: "Full Superpowers support via the official marketplace.",
      };
    case "codex":
    case "antigravity":
      return {
        level: "subset",
        note:
          "Partial support: install the compatible skill subset per the " +
          "Superpowers repo instructions; some skills may be unavailable.",
      };
    case "opencode":
      return {
        level: "skip",
        note:
          "Superpowers reports skill clashes on OpenCode — skipping. " +
          "Equivalent TDD/contract skills can be sourced from the curated " +
          "allowlist instead.",
      };
    default:
      return {
        level: "subset",
        note: `Unknown platform "${platform}"; attempting the compatible subset.`,
      };
  }
}

export interface SuperpowersInstallResult {
  ok: boolean;
  level: SuperpowersSupport;
  message: string;
}

export async function installSuperpowers(
  platform: string,
  opts: { cwd: string; dryRun?: boolean },
): Promise<SuperpowersInstallResult> {
  const support = supportFor(platform);
  if (support.level === "skip") {
    return { ok: true, level: "skip", message: support.note };
  }

  // Claude Code installs via its plugin marketplace; other platforms use the
  // repo instructions. We only automate the Claude Code path; otherwise we
  // record guidance rather than guessing at a platform's plugin mechanism.
  if (platform === "claude-code") {
    const cmds = [
      ["claude", ["plugin", "marketplace", "add", "obra/superpowers-marketplace"]],
      ["claude", ["plugin", "install", "superpowers@superpowers-marketplace"]],
    ] as const;
    if (opts.dryRun) {
      return {
        ok: true,
        level: "full",
        message: cmds.map(([c, a]) => `would run: ${c} ${a.join(" ")}`).join("\n"),
      };
    }
    for (const [cmd, args] of cmds) {
      const res = await run(cmd, [...args], { cwd: opts.cwd, timeoutMs: 120_000 });
      if (res.code !== 0) {
        return {
          ok: true, // never fail init over Superpowers
          level: "subset",
          message:
            `Could not auto-install Superpowers via Claude Code (exit ${res.code}). ` +
            `Install manually: \`/plugin install superpowers@superpowers-marketplace\`.`,
        };
      }
    }
    return { ok: true, level: "full", message: "Superpowers installed (Claude Code)." };
  }

  return {
    ok: true,
    level: support.level,
    message: support.note,
  };
}
