/**
 * Capability → platform-native tool resolution (spec R4).
 *
 * Agents declare abstract capabilities (read/write/exec/web_search/web_fetch).
 * Each platform adapter maps them to its native tool names. This keeps the
 * same `.subagents/*.yaml` valid on Claude Code, Antigravity, Codex, etc.
 */
import type { Capability } from "../schema.js";

export type CapabilityMap = Record<Capability, string[]>;

/** Built-in maps for the platforms shipped in v1. */
export const CAPABILITY_MAPS: Record<string, CapabilityMap> = {
  "claude-code": {
    read: ["Read", "Grep", "Glob"],
    write: ["Write", "Edit"],
    exec: ["Bash"],
    web_search: ["WebSearch"],
    web_fetch: ["WebFetch"],
  },
  antigravity: {
    read: ["read_file", "search"],
    write: ["write_file", "edit_file"],
    exec: ["run_command"],
    // Antigravity gets fresh context via Gemini search grounding, exposed
    // here as an explicit capability the adapter can assert on.
    web_search: ["google_search_grounding"],
    web_fetch: ["fetch_url"],
  },
  codex: {
    read: ["read_file", "grep"],
    write: ["apply_patch"],
    exec: ["shell"],
    web_search: ["web_search"],
    web_fetch: ["web_fetch"],
  },
};

export interface ResolvedCapabilities {
  tools: string[];
  /** Capabilities the platform could not satisfy. */
  unsupported: Capability[];
}

export function resolveCapabilities(
  capabilities: Capability[],
  platform: string,
): ResolvedCapabilities {
  const map = CAPABILITY_MAPS[platform];
  if (!map) {
    throw new Error(
      `No capability map for platform "${platform}". ` +
        `Register one in capability-resolver.ts or via an adapter.`,
    );
  }
  const tools: string[] = [];
  const unsupported: Capability[] = [];
  for (const cap of capabilities) {
    const native = map[cap];
    if (native && native.length > 0) {
      tools.push(...native);
    } else {
      unsupported.push(cap);
    }
  }
  return { tools: [...new Set(tools)], unsupported };
}

/** Does the platform expose any web-search capability for this agent? */
export function hasResolvableSearch(platform: string): boolean {
  const map = CAPABILITY_MAPS[platform];
  return Boolean(map && map.web_search && map.web_search.length > 0);
}
