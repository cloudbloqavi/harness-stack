/**
 * The build pipeline: canonical `.subagents/*.yaml` → platform-native agent
 * files. Resolves model tier + capabilities, enforces the fresh-context
 * mandate, then renders via the active platform adapter (spec R3–R5, R7).
 */
import type { Subagent } from "./schema.js";
import { commandName, exposesSkill, exposesCommand } from "./schema.js";
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
  /** Decision-routable skill / manual command artifacts (may be empty). */
  manualFiles: GeneratedFile[];
  warnings: string[];
}

export interface BuildReport {
  results: AgentBuildResult[];
  errors: string[];
  /** Build-level notes (e.g. a platform's skill mapping is still pending). */
  notes: string[];
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
  const notes: string[] = [];
  let pendingManual = 0;

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

    // Optional manual surfaces: a decision-routable skill and/or a slash
    // command, each a thin launcher that dispatches this same sub-agent.
    const manualFiles: GeneratedFile[] = [];
    const wantsManual = exposesSkill(agent) || exposesCommand(agent);
    if (wantsManual) {
      const ctx = {
        agent,
        platform: opts.platform,
        command: commandName(agent),
      };
      if (exposesSkill(agent) && adapter.renderSkill) {
        manualFiles.push(adapter.renderSkill(ctx));
      }
      if (exposesCommand(agent) && adapter.renderCommand) {
        manualFiles.push(adapter.renderCommand(ctx));
      }
      // Platform mapping not yet available — sub-agent dispatch still works.
      if (!adapter.renderSkill && !adapter.renderCommand) pendingManual++;
    }

    results.push({ agent, file, manualFiles, warnings });
  }

  if (pendingManual > 0) {
    notes.push(
      `${pendingManual} agent(s) request a skill/command surface, but ${opts.platform}'s ` +
        `native mechanism is not mapped yet${adapter.skillSupport.note ? ` (${adapter.skillSupport.note})` : ""}. ` +
        `Sub-agent dispatch still works; the harness-init-agent will wire the manual surfaces.`,
    );
  }

  return { results, errors, notes };
}
