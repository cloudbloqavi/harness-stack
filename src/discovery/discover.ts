/**
 * Discovery & reuse workflow (spec R2).
 *
 *   1. EXACT MATCH   — name == task slug → reuse as-is.
 *   2. SIMILAR MATCH — score every spec against the task; ≥ 0.75 = similar.
 *   3. CREATE NEW    — generate a new spec (consent-gated by the caller).
 *
 * This module is pure: it reports what it found. Writing to `.subagents/` and
 * asking for consent is the caller's job, keeping the invariant that the folder
 * is never written without developer consent.
 */
import type { Subagent } from "../schema.js";
import { scoreSimilarity } from "./similarity.js";

export const SIMILARITY_THRESHOLD = 0.75;

export interface TaskSpec {
  /** Kebab-case slug derived from the task; matched against agent names. */
  slug: string;
  description: string;
  goal?: string;
}

export interface SimilarityHit {
  agent: Subagent;
  score: number;
}

export type DiscoveryOutcome =
  | { kind: "exact"; agent: Subagent }
  | { kind: "similar"; matches: SimilarityHit[] }
  | { kind: "none" };

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function discover(
  task: TaskSpec,
  existing: Subagent[],
): DiscoveryOutcome {
  // 1. Exact match by name.
  const exact = existing.find((a) => a.name === task.slug);
  if (exact) return { kind: "exact", agent: exact };

  // 2. Similarity over description + goal.
  const taskText = `${task.description} ${task.goal ?? ""}`;
  const matches: SimilarityHit[] = existing
    .map((agent) => ({
      agent,
      score: scoreSimilarity(
        taskText,
        `${agent.description} ${agent.goal} ${agent.name}`,
      ),
    }))
    .filter((h) => h.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (matches.length > 0) return { kind: "similar", matches };

  // 3. Nothing close enough — caller should create.
  return { kind: "none" };
}
