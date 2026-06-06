/**
 * Platform-agnostic model resolution (spec R3).
 *
 * Agents declare an abstract `model_tier`. The active platform adapter reads
 * `.harness/model-map.yaml` to substitute the concrete model. Concrete model
 * names live in exactly one place — the model map — so keeping Harness current
 * means editing one file, not every agent spec.
 */
import type { ModelTier, Subagent } from "../schema.js";
import { MODEL_TIERS } from "../schema.js";

export type ModelMap = Record<string, Partial<Record<ModelTier, string>>>;

export interface ResolvedModel {
  model: string;
  /** True when the requested tier was missing and we fell back. */
  fellBack: boolean;
  /** The tier actually used after any fallback. */
  effectiveTier: ModelTier;
  warning?: string;
}

/** Tiers in descending capability order, used for fallback. */
const TIER_FALLBACK: ModelTier[] = ["deep", "reasoning", "fast"];

/**
 * Resolve an agent's model for a given platform.
 *
 * Precedence:
 *   1. `model_overrides[platform]` on the agent wins outright.
 *   2. `model-map.yaml[platform][tier]`.
 *   3. If the tier is missing on that platform, fall back to the next tier
 *      *down* (deep → reasoning → fast) and emit a warning.
 */
export function resolveModel(
  agent: Pick<Subagent, "model_tier" | "model_overrides">,
  platform: string,
  modelMap: ModelMap,
): ResolvedModel {
  const override = agent.model_overrides?.[platform];
  if (override) {
    return { model: override, fellBack: false, effectiveTier: agent.model_tier };
  }

  const platformMap = modelMap[platform];
  if (!platformMap) {
    throw new Error(
      `No model map entry for platform "${platform}". ` +
        `Add a "${platform}:" block to .harness/model-map.yaml.`,
    );
  }

  const tier = agent.model_tier;
  const direct = platformMap[tier];
  if (direct) {
    return { model: direct, fellBack: false, effectiveTier: tier };
  }

  // `inherit` should always be present; if not, surface it clearly.
  if (tier === "inherit") {
    throw new Error(
      `Platform "${platform}" has no "inherit" mapping in model-map.yaml.`,
    );
  }

  // Fall back to the next available tier *down* the capability ladder.
  const startIdx = TIER_FALLBACK.indexOf(tier);
  for (let i = startIdx + 1; i < TIER_FALLBACK.length; i++) {
    const candidate = TIER_FALLBACK[i]!;
    const model = platformMap[candidate];
    if (model) {
      return {
        model,
        fellBack: true,
        effectiveTier: candidate,
        warning:
          `Platform "${platform}" has no "${tier}" model; ` +
          `falling back to "${candidate}" (${model}).`,
      };
    }
  }

  throw new Error(
    `Platform "${platform}" has no model for tier "${tier}" ` +
      `and no lower tier to fall back to. Fix .harness/model-map.yaml.`,
  );
}

export function isValidTier(tier: string): tier is ModelTier {
  return (MODEL_TIERS as readonly string[]).includes(tier);
}
