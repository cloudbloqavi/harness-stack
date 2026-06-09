/**
 * Codex adapter.
 *
 * Emits a Codex agent definition as TOML-ish frontmatter is not standard, so
 * we use a JSON sidecar plus a prompt body, which Codex's agent loader reads.
 */
import type { GeneratedFile, PlatformAdapter, ResolvedAgent } from "./types.js";

export const codexAdapter: PlatformAdapter = {
  id: "codex",
  displayName: "Codex",
  skillSupport: {
    verified: false,
    note: "Codex command/skill mechanism not yet mapped — the harness-init-agent confirms it via research.",
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
};
