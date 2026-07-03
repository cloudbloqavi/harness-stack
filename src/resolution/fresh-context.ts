/**
 * Fresh-context enforcement (spec R5).
 *
 * Any agent with `requires_fresh_context: true` MUST end up with a resolvable
 * web_search tool AND Context7 available, or the build fails with an
 * actionable error. No agent reasons about libraries, APIs, versions, or CVEs
 * from stale training data.
 */
import type { Subagent } from "../schema.js";
import { hasResolvableSearch } from "./capability-resolver.js";

export const CONTEXT7_MCP = {
  name: "context7",
  mode: "url" as const,
  url: "https://mcp.context7.com/mcp",
  auth: "none" as const,
  base: true,
};

export interface FreshContextResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validate an agent's fresh-context requirements against a platform and the
 * set of base MCP servers installed for the project.
 */
export function checkFreshContext(
  agent: Subagent,
  platform: string,
  baseMcpNames: ReadonlySet<string>,
): FreshContextResult {
  if (!agent.requires_fresh_context) return { ok: true, errors: [] };

  const errors: string[] = [];

  // 1. Must declare web_search AND the platform must resolve it.
  if (!agent.capabilities.includes("web_search")) {
    errors.push(
      `agent "${agent.name}" sets requires_fresh_context: true but does not ` +
        `declare the "web_search" capability.`,
    );
  } else if (!hasResolvableSearch(platform)) {
    errors.push(
      `agent "${agent.name}" requires fresh context but platform ` +
        `"${platform}" exposes no web_search tool. Add a search mapping for ` +
        `this platform before building.`,
    );
  }

  // 2. Context7 must be available (declared on the agent or installed as base).
  const hasContext7 =
    agent.mcp_servers.some((m) => m.name === "context7") ||
    baseMcpNames.has("context7");
  if (!hasContext7) {
    errors.push(
      `agent "${agent.name}" requires fresh context but Context7 is not ` +
        `available. Install it as a base MCP (harness init) or add it to the ` +
        `agent's mcp_servers.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
