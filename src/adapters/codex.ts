/**
 * Codex adapter.
 *
 * Emits a Codex agent definition as TOML-ish frontmatter is not standard, so
 * we use a JSON sidecar plus a prompt body, which Codex's agent loader reads.
 */
import type {
  GeneratedFile,
  ManualContext,
  PlatformAdapter,
  ResolvedAgent,
} from "./types.js";
import { launcherBody, withFrontmatter } from "./manual.js";

export const codexAdapter: PlatformAdapter = {
  id: "codex",
  displayName: "Codex",
  // Verified: Codex Agent Skills live in .agents/skills/<name>/SKILL.md (scanned
  // up to the repo root). Implicit + explicit ($name) invocation, toggled by
  // allow_implicit_invocation. Custom prompts (~/.codex/prompts) are deprecated
  // and home-only, so the repo-shareable surface is the skill.
  // https://developers.openai.com/codex/skills
  skillSupport: {
    verified: true,
    note: ".agents/skills/<cmd>/SKILL.md — implicit when skill, explicit $<cmd> when command-only.",
  },
  render({ agent, model, tools }: ResolvedAgent): GeneratedFile {
    const definition = {
      name: agent.name,
      description: agent.description.trim(),
      model: model.effectiveTier === "inherit" ? "inherit" : model.model,
      tools,
      triggers: agent.triggers,
      generated_by: "harness",
      source: `.subagents/${agent.name}.yaml`,
      prompt: agent.prompt.trim(),
    };
    return {
      relPath: `.codex/agents/${agent.name}.json`,
      contents: JSON.stringify(definition, null, 2) + "\n",
    };
  },

  renderManual({ agent, command, wantsSkill }: ManualContext): GeneratedFile[] {
    // One Agent-Skill file serves both surfaces. When only a manual command is
    // wanted, disable implicit invocation so it runs only via explicit $<cmd>.
    const fm: Record<string, unknown> = {
      name: command,
      description: agent.description.trim(),
    };
    if (!wantsSkill) fm.allow_implicit_invocation = false;
    return [
      {
        relPath: `.agents/skills/${command}/SKILL.md`,
        contents: withFrontmatter(
          fm,
          launcherBody(agent, wantsSkill ? "skill" : "command"),
        ),
      },
    ];
  },
};
