import { describe, it, expect } from "vitest";
import { resolveCapabilities } from "../src/resolution/capability-resolver.js";
import { checkFreshContext } from "../src/resolution/fresh-context.js";
import { parseSubagent } from "../src/schema.js";

describe("resolveCapabilities (R4)", () => {
  it("maps web_search to each platform's native search tool", () => {
    expect(resolveCapabilities(["web_search"], "claude-code").tools).toContain("WebSearch");
    expect(resolveCapabilities(["web_search"], "antigravity").tools).toContain("google_search_grounding");
    expect(resolveCapabilities(["web_search"], "codex").tools).toContain("web_search");
  });
});

const base = {
  name: "x",
  description: "d",
  goal: "g",
  type: "on-demand",
  model_tier: "reasoning",
  prompt: "p",
};

describe("checkFreshContext (R5)", () => {
  it("passes when search + Context7 are available", () => {
    const agent = parseSubagent({
      ...base,
      capabilities: ["read", "web_search"],
      requires_fresh_context: true,
    });
    const res = checkFreshContext(agent, "claude-code", new Set(["context7"]));
    expect(res.ok).toBe(true);
  });

  it("fails with an actionable error when web_search is missing", () => {
    const agent = parseSubagent({
      ...base,
      capabilities: ["read"],
      requires_fresh_context: true,
    });
    const res = checkFreshContext(agent, "claude-code", new Set(["context7"]));
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/web_search/);
  });

  it("fails when Context7 is unavailable", () => {
    const agent = parseSubagent({
      ...base,
      capabilities: ["read", "web_search"],
      requires_fresh_context: true,
    });
    const res = checkFreshContext(agent, "claude-code", new Set());
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/Context7/);
  });

  it("is a no-op when fresh context is not required", () => {
    const agent = parseSubagent({
      ...base,
      capabilities: ["read"],
      requires_fresh_context: false,
    });
    expect(checkFreshContext(agent, "claude-code", new Set()).ok).toBe(true);
  });
});
