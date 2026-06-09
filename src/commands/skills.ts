/**
 * `harness skills` — show how each sub-agent is exposed for invocation on the
 * active platform: as a decision-routable skill, a manual slash command, or
 * sub-agent dispatch only. Mirrors `harness hooks` for the invocation surface.
 */
import { loadSubagents } from "../project.js";
import {
  commandName,
  exposesSkill,
  exposesCommand,
  type Subagent,
} from "../schema.js";
import { getAdapter } from "../adapters/registry.js";
import { log } from "../util/log.js";

export interface SkillsOptions {
  root: string;
  platform: string;
}

function surfaces(agent: Subagent, hasSkill: boolean, hasCommand: boolean): string {
  const cmd = commandName(agent);
  const parts: string[] = [];
  if (exposesSkill(agent)) {
    parts.push(hasSkill ? "skill (decision-routed)" : "skill (pending)");
  }
  if (exposesCommand(agent)) {
    parts.push(hasCommand ? `/${cmd} (manual)` : `/${cmd} (pending)`);
  }
  return parts.length > 0 ? parts.join(", ") : "subagent dispatch only";
}

export async function runSkills(opts: SkillsOptions): Promise<void> {
  const agents = await loadSubagents(opts.root);
  if (agents.length === 0) {
    log.warn("No .subagents/*.yaml found. Run `harness init` first.");
    return;
  }
  const adapter = getAdapter(opts.platform);
  const hasSkill = Boolean(adapter.renderSkill);
  const hasCommand = Boolean(adapter.renderCommand);

  log.info(
    `${opts.platform}:` +
      (adapter.skillSupport.verified
        ? ""
        : "  (skill/command mechanism unverified — pending init research)"),
  );

  let pending = 0;
  for (const agent of [...agents].sort((a, b) => a.name.localeCompare(b.name))) {
    log.detail(`  ${agent.name}  ->  ${surfaces(agent, hasSkill, hasCommand)}`);
    if ((exposesSkill(agent) || exposesCommand(agent)) && !hasSkill && !hasCommand) {
      pending++;
    }
  }

  if (pending > 0) {
    log.warn(
      `  ${pending} agent(s) request a manual surface ${opts.platform} can't emit yet. ` +
        `Sub-agent dispatch works now; the harness-init-agent will wire the native ` +
        `skill/command mechanism via search + Context7.`,
    );
  }
}
