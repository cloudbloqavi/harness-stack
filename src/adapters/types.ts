/** Adapter contract: canonical Subagent → platform-native agent file. */
import type { Subagent } from "../schema.js";
import type { ResolvedModel } from "../resolution/model-resolver.js";

export interface ResolvedAgent {
  agent: Subagent;
  platform: string;
  model: ResolvedModel;
  /** Platform-native tool names mapped from abstract capabilities. */
  tools: string[];
  /** Capabilities the platform could not satisfy (already warned). */
  unsupportedCapabilities: string[];
}

export interface GeneratedFile {
  /** Path relative to the project root. */
  relPath: string;
  contents: string;
}

/** Context for rendering a manual/skill entry point that wraps a sub-agent. */
export interface ManualContext {
  agent: Subagent;
  platform: string;
  /** Resolved slash/skill command name. */
  command: string;
}

export interface PlatformAdapter {
  /** Stable id, matches keys in model-map.yaml. */
  readonly id: string;
  readonly displayName: string;
  /** Render one resolved agent into its platform-native sub-agent file. */
  render(resolved: ResolvedAgent): GeneratedFile;
  /**
   * Whether the skill/command mechanism is confirmed against the platform's
   * current docs. `false` means the bundled mapping is a best-known default
   * the harness-init-agent refreshes via research (mirrors the trigger map).
   */
  readonly skillSupport: { verified: boolean; note?: string };
  /** Decision-routable skill artifact (omit while the mapping is pending). */
  renderSkill?(ctx: ManualContext): GeneratedFile;
  /** Manual slash-command artifact (omit while the mapping is pending). */
  renderCommand?(ctx: ManualContext): GeneratedFile;
}
