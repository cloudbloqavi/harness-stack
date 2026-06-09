import { describe, it, expect } from "vitest";
import {
  parseSubagent,
  commandName,
  exposesSkill,
  exposesCommand,
} from "../src/schema.js";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";
import { cursorAdapter } from "../src/adapters/cursor.js";
import { buildRoster } from "../src/build.js";
import type { ModelMap } from "../src/resolution/model-resolver.js";

function agent(overrides: Record<string, unknown> = {}) {
  return parseSubagent({
    name: "demo-agent",
    description: "Demo agent.",
    goal: "Do the demo thing.",
    type: "on-demand",
    model_tier: "fast",
    capabilities: ["read"],
    prompt: "You are the demo agent.",
    ...overrides,
  });
}

describe("schema: invocation surfaces", () => {
  it("defaults expose_as to [subagent]", () => {
    const a = agent();
    expect(a.expose_as).toEqual(["subagent"]);
    expect(exposesSkill(a)).toBe(false);
    expect(exposesCommand(a)).toBe(false);
  });

  it("derives the command name by stripping -agent", () => {
    expect(commandName(agent())).toBe("demo");
    expect(commandName(agent({ command: "do-it" }))).toBe("do-it");
  });

  it("reads skill/command exposure flags", () => {
    const a = agent({ expose_as: ["subagent", "skill", "command"] });
    expect(exposesSkill(a)).toBe(true);
    expect(exposesCommand(a)).toBe(true);
  });
});

describe("claude-code adapter: skill + command artifacts", () => {
  const ctx = { agent: agent({ command: "demo" }), platform: "claude-code", command: "demo" };

  it("is verified and emits a SKILL.md launcher", () => {
    expect(claudeCodeAdapter.skillSupport.verified).toBe(true);
    const f = claudeCodeAdapter.renderSkill!(ctx);
    expect(f.relPath).toBe(".claude/skills/demo/SKILL.md");
    expect(f.contents).toContain("name: demo");
    // Thin launcher → dispatches the sub-agent rather than inlining the prompt.
    expect(f.contents).toContain("demo-agent");
    expect(f.contents).toContain(".claude/agents/demo-agent.md");
  });

  it("emits a slash command file", () => {
    const f = claudeCodeAdapter.renderCommand!(ctx);
    expect(f.relPath).toBe(".claude/commands/demo.md");
    expect(f.contents).toContain("demo-agent");
  });
});

describe("cursor adapter: manual surface pending", () => {
  it("declares skill support unverified and has no renderers yet", () => {
    expect(cursorAdapter.skillSupport.verified).toBe(false);
    expect(cursorAdapter.renderSkill).toBeUndefined();
    expect(cursorAdapter.renderCommand).toBeUndefined();
  });
});

const modelMap: ModelMap = {
  "claude-code": { fast: "F", reasoning: "R", deep: "D", inherit: "inherit" },
  cursor: { fast: "inherit", reasoning: "inherit", deep: "inherit", inherit: "inherit" },
};

describe("buildRoster: manual files", () => {
  it("emits skill + command files only for exposed agents (claude-code)", () => {
    const agents = [
      agent({ name: "router-agent", expose_as: ["subagent", "skill", "command"], command: "route" }),
      agent({ name: "plain-agent" }), // subagent-only
    ];
    const report = buildRoster(agents, {
      platform: "claude-code",
      modelMap,
      baseMcpNames: new Set(),
    });
    expect(report.errors).toEqual([]);
    const router = report.results.find((r) => r.agent.name === "router-agent")!;
    const plain = report.results.find((r) => r.agent.name === "plain-agent")!;
    expect(router.manualFiles.map((f) => f.relPath).sort()).toEqual([
      ".claude/commands/route.md",
      ".claude/skills/route/SKILL.md",
    ]);
    expect(plain.manualFiles).toEqual([]);
    expect(report.notes).toEqual([]);
  });

  it("notes pending manual surfaces on an unmapped platform (cursor)", () => {
    const agents = [
      agent({ name: "router-agent", expose_as: ["subagent", "command"], command: "route" }),
    ];
    const report = buildRoster(agents, {
      platform: "cursor",
      modelMap,
      baseMcpNames: new Set(),
    });
    expect(report.errors).toEqual([]);
    expect(report.results[0]!.manualFiles).toEqual([]);
    expect(report.notes.length).toBe(1);
    expect(report.notes[0]).toContain("cursor");
  });
});
