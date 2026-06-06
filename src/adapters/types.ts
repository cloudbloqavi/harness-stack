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

export interface PlatformAdapter {
  /** Stable id, matches keys in model-map.yaml. */
  readonly id: string;
  readonly displayName: string;
  /** Render one resolved agent into its platform-native file. */
  render(resolved: ResolvedAgent): GeneratedFile;
}
