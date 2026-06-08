/** Registry of known platform adapters. */
import type { PlatformAdapter } from "./types.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { antigravityAdapter } from "./antigravity.js";
import { codexAdapter } from "./codex.js";
import { cursorAdapter } from "./cursor.js";
import { copilotAdapter } from "./copilot.js";

const ADAPTERS: Record<string, PlatformAdapter> = {
  [claudeCodeAdapter.id]: claudeCodeAdapter,
  [antigravityAdapter.id]: antigravityAdapter,
  [codexAdapter.id]: codexAdapter,
  [cursorAdapter.id]: cursorAdapter,
  [copilotAdapter.id]: copilotAdapter,
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

export function listAdapters(): { id: string; displayName: string }[] {
  return Object.values(ADAPTERS).map((a) => ({
    id: a.id,
    displayName: a.displayName,
  }));
}
