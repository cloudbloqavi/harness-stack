/** Registry of known platform adapters. */
import type { PlatformAdapter } from "./types.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { antigravityAdapter } from "./antigravity.js";
import { codexAdapter } from "./codex.js";

const ADAPTERS: Record<string, PlatformAdapter> = {
  [claudeCodeAdapter.id]: claudeCodeAdapter,
  [antigravityAdapter.id]: antigravityAdapter,
  [codexAdapter.id]: codexAdapter,
};

export function getAdapter(platform: string): PlatformAdapter {
  const adapter = ADAPTERS[platform];
  if (!adapter) {
    throw new Error(
      `Unknown platform "${platform}". Known: ${Object.keys(ADAPTERS).join(", ")}.`,
    );
  }
  return adapter;
}

export function listPlatforms(): string[] {
  return Object.keys(ADAPTERS);
}
