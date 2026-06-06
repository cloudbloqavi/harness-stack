/**
 * The build pipeline: canonical `.subagents/*.yaml` → platform-native agent
 * files. Resolves model tier + capabilities, enforces the fresh-context
 * mandate, then renders via the active platform adapter (spec R3–R5, R7).
 */
import type { Subagent } from "./schema.js";
import type { ModelMap } from "./resolution/model-resolver.js";
import { resolveModel } from "./resolution/model-resolver.js";
import { resolveCapabilities } from "./resolution/capability-resolver.js";
import { checkFreshContext } from "./resolution/fresh-context.js";
import { getAdapter } from "./adapters/registry.js";
import type { GeneratedFile } from "./adapters/types.js";

export interface BuildOptions {
  platform: string;
  modelMap: ModelMap;
  baseMcpNames: ReadonlySet<string>;
}

export interface AgentBuildResult {
  agent: Subagent;
  file: GeneratedFile;
  warnings: string[];
}

export interface BuildReport {
  results: AgentBuildResult[];
  errors: string[];
}

/**
 * Build the full roster. Collects every fresh-context / resolution error so the
 * caller can fail the build with one clear, complete message rather than dying
 * on the first bad agent.
 */
export function buildRoster(
  agents: Subagent[],
  opts: BuildOptions,
): BuildReport {
  const adapter = getAdapter(opts.platform);
  const results: AgentBuildResult[] = [];
  const errors: string[] = [];

  for (const agent of agents) {
    const warnings: string[] = [];

    // Fresh-context enforcement — hard failure if unmet.
    const fc = checkFreshContext(agent, opts.platform, opts.baseMcpNames);
    if (!fc.ok) {
      errors.push(...fc.errors);
      continue;
    }

    let model;
    try {
      model = resolveModel(agent, opts.platform, opts.modelMap);
    } catch (err) {
      errors.push((err as Error).message);
      continue;
    }
    if (model.warning) warnings.push(model.warning);

    const caps = resolveCapabilities(agent.capabilities, opts.platform);
    if (caps.unsupported.length > 0) {
      warnings.push(
        `capabilities not supported on ${opts.platform}: ${caps.unsupported.join(", ")}`,
      );
    }

    const file = adapter.render({
      agent,
      platform: opts.platform,
      model,
      tools: caps.tools,
      unsupportedCapabilities: caps.unsupported,
    });

    results.push({ agent, file, warnings });
  }

  return { results, errors };
}
