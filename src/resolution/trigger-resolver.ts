/**
 * Trigger → native event-hook resolution.
 *
 * Agents declare abstract triggers (on_init / on_commit / on_check / on_demand).
 * Each agentic platform (Claude Code, Antigravity, Codex, Cursor, Copilot)
 * exposes its own event hooks. This resolver maps an abstract trigger to the
 * platform's native hook where one exists, and falls back to a Harness-managed
 * mechanism (e.g. an installed git hook or `harness check`) where it does not.
 *
 * Like the model map, the concrete mapping lives in a single editable file —
 * `.harness/trigger-map.yaml` — because platform hook APIs drift. The
 * `harness-init-agent` refreshes that file by researching the active
 * platform's current hook documentation (fresh-context mandate).
 */
import type { Trigger } from "../schema.js";

export type HookKind = "native" | "git-hook" | "harness";

export interface HookBinding {
  /** native  = the platform fires this directly (e.g. SessionStart).
   *  git-hook = Harness installs a git hook (e.g. post-commit).
   *  harness  = Harness-managed fallback (e.g. `harness check`). */
  kind: HookKind;
  /** Native or git-hook name. */
  hook?: string;
  /** Harness fallback mechanism description. */
  mechanism?: string;
  /** false => shipped as a best-known default; init agent must confirm via research. */
  verified?: boolean;
  note?: string;
}

export type TriggerMap = Record<string, Partial<Record<Trigger, HookBinding>>>;

/** The Harness-managed fallback used when a platform has no binding. */
export function harnessFallback(trigger: Trigger): HookBinding {
  const mechanism =
    trigger === "on_commit"
      ? "Harness-installed git post-commit hook"
      : trigger === "on_check"
        ? "`harness check` (manual or CI)"
        : trigger === "on_init"
          ? "`harness init` / first-run bootstrap"
          : "direct invocation by the orchestrator";
  return { kind: "harness", mechanism, verified: true };
}

export interface ResolvedTrigger {
  trigger: Trigger;
  binding: HookBinding;
  /** True when no platform-native binding existed and we fell back to Harness. */
  fellBack: boolean;
}

/** Resolve a single trigger for a platform. */
export function resolveTrigger(
  platform: string,
  trigger: Trigger,
  map: TriggerMap,
): ResolvedTrigger {
  const platformMap = map[platform];
  if (!platformMap) {
    throw new Error(
      `No trigger map entry for platform "${platform}". ` +
        `Add a "${platform}:" block to .harness/trigger-map.yaml.`,
    );
  }
  const binding = platformMap[trigger];
  // Absent, or explicitly marked unsupported (kind "harness" with no detail) => fallback.
  if (!binding) {
    return { trigger, binding: harnessFallback(trigger), fellBack: true };
  }
  return { trigger, binding, fellBack: binding.kind === "harness" };
}

/** Resolve every trigger declared by an agent, de-duplicated. */
export function resolveAgentTriggers(
  triggers: readonly Trigger[],
  platform: string,
  map: TriggerMap,
): ResolvedTrigger[] {
  const seen = new Set<Trigger>();
  const out: ResolvedTrigger[] = [];
  for (const t of triggers) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(resolveTrigger(platform, t, map));
  }
  return out;
}

export function describeBinding(b: HookBinding): string {
  const base =
    b.kind === "native"
      ? `native hook: ${b.hook}`
      : b.kind === "git-hook"
        ? `git hook: ${b.hook}`
        : `Harness fallback: ${b.mechanism}`;
  const flag = b.verified === false ? " (unverified — confirm via research)" : "";
  return base + flag;
}
