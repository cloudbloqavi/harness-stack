/**
 * `harness skills` — show how each sub-agent is exposed for invocation on the
 * active platform: as a decision-routable skill, a manual slash command, or
 * sub-agent dispatch only, with the concrete files each produces. Mirrors
 * `harness hooks` for the invocation surface.
 */
import { loadSubagents } from "../project.js";
import { commandName, exposesSkill, exposesCommand } from "../schema.js";
import { getAdapter } from "../adapters/registry.js";
import { log } from "../util/log.js";

export interface SkillsOptions {
  root: string;
  platform: string;
}

export async function runSkills(opts: SkillsOptions): Promise<void> {
  const agents = await loadSubagents(opts.root);
  if (agents.length === 0) {
    log.warn("No .subagents/*.yaml found. Run `harness init` first.");
    return;
  }
  const adapter = getAdapter(opts.platform);

  log.info(
    `${opts.platform}:` +
      (adapter.skillSupport.verified
        ? ` ✓ verified — ${adapter.skillSupport.note ?? ""}`
        : "  (skill/command mechanism unverified — pending init research)"),
  );

  let pending = 0;
  for (const agent of [...agents].sort((a, b) => a.name.localeCompare(b.name))) {
    const wantsSkill = exposesSkill(agent);
    const wantsCommand = exposesCommand(agent);

    if (!wantsSkill && !wantsCommand) {
      log.detail(`  ${agent.name}  ->  subagent dispatch only`);
      continue;
    }
    if (!adapter.renderManual) {
      log.detail(`  ${agent.name}  ->  pending (${opts.platform} mechanism unmapped)`);
      pending++;
      continue;
    }
    const files = adapter.renderManual({
      agent,
      platform: opts.platform,
      command: commandName(agent),
      wantsSkill,
      wantsCommand,
    });
    log.detail(`  ${agent.name}  ->  ${files.map((f) => f.relPath).join(", ")}`);
  }

  if (pending > 0) {
    log.warn(
      `  ${pending} agent(s) request a manual surface ${opts.platform} can't emit yet. ` +
        `Sub-agent dispatch works now; the harness-init-agent will wire the native ` +
        `mechanism via search + Context7.`,
    );
  }
}
