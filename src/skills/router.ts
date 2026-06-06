/**
 * Skill sourcing precedence + recommendation protocol (spec R9, R10).
 *
 * The skills-router searches sources in a fixed precedence order and labels
 * each candidate's provenance. No skill is ever invoked silently: every use is
 * surfaced as (skill | source | what | why-now) and consent-gated.
 */
import { confirm, isApproved, type ConsentOptions } from "../util/consent.js";

export type SkillSource =
  | "Spec Kit"
  | "Superpowers"
  | "Curated allowlist"
  | "Harness-native";

/** Precedence order used when ranking candidates from multiple sources. */
export const SOURCE_PRECEDENCE: SkillSource[] = [
  "Spec Kit",
  "Superpowers",
  "Curated allowlist",
  "Harness-native",
];

export interface SkillCandidate {
  name: string;
  source: SkillSource;
  /** What the skill does. */
  what: string;
  /** Why it matters for the task at hand, right now. */
  whyNow: string;
  /** Optional trust/maintenance signal (stars, last-updated, "vetted"). */
  trustSignal?: string;
  /** Raw relevance score from the router (higher = better). */
  score?: number;
}

/** Rank candidates by source precedence, then by score. */
export function rankCandidates(candidates: SkillCandidate[]): SkillCandidate[] {
  return [...candidates].sort((a, b) => {
    const pa = SOURCE_PRECEDENCE.indexOf(a.source);
    const pb = SOURCE_PRECEDENCE.indexOf(b.source);
    if (pa !== pb) return pa - pb;
    return (b.score ?? 0) - (a.score ?? 0);
  });
}

/** Render the standard recommendation card for a skill. */
export function renderRecommendation(c: SkillCandidate): string {
  return [
    `  Skill    : ${c.name}`,
    `  Source   : ${c.source}`,
    `  What     : ${c.what}`,
    `  Why now  : ${c.whyNow}`,
    ...(c.trustSignal ? [`  Trust    : ${c.trustSignal}`] : []),
  ].join("\n");
}

/**
 * Present a skill and ask for consent (y / n / always-for-project).
 * Returns whether the skill is approved for use. Declined skills are parked
 * (remembered) by the consent store and not re-prompted.
 */
export async function recommendSkill(
  c: SkillCandidate,
  opts: ConsentOptions = {},
): Promise<boolean> {
  console.log(renderRecommendation(c));
  const answer = await confirm("Use this skill?", {
    ...opts,
    key: `skill:${c.source}:${c.name}`,
  });
  return isApproved(answer);
}
