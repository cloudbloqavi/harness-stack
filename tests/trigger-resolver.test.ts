import { describe, it, expect } from "vitest";
import {
  resolveTrigger,
  resolveAgentTriggers,
  harnessFallback,
  type TriggerMap,
} from "../src/resolution/trigger-resolver.js";

const map: TriggerMap = {
  "claude-code": {
    on_init: { kind: "native", hook: "SessionStart", verified: true },
    on_commit: { kind: "git-hook", hook: "post-commit", verified: true },
    on_check: { kind: "harness", mechanism: "harness check", verified: true },
    // on_demand intentionally omitted -> fallback
  },
  copilot: {
    on_init: { kind: "harness", mechanism: "bootstrap", verified: false },
  },
};

describe("resolveTrigger (trigger -> native hook)", () => {
  it("resolves a native hook", () => {
    const r = resolveTrigger("claude-code", "on_init", map);
    expect(r.binding.kind).toBe("native");
    expect(r.binding.hook).toBe("SessionStart");
    expect(r.fellBack).toBe(false);
  });

  it("maps on_commit to an installed git hook (no native commit event)", () => {
    const r = resolveTrigger("claude-code", "on_commit", map);
    expect(r.binding.kind).toBe("git-hook");
  });

  it("falls back to a Harness mechanism when the trigger is unmapped", () => {
    const r = resolveTrigger("claude-code", "on_demand", map);
    expect(r.fellBack).toBe(true);
    expect(r.binding.kind).toBe("harness");
    expect(r.binding).toEqual(harnessFallback("on_demand"));
  });

  it("treats an explicit harness binding as a fallback", () => {
    const r = resolveTrigger("copilot", "on_init", map);
    expect(r.fellBack).toBe(true);
    expect(r.binding.verified).toBe(false);
  });

  it("throws a clear error for an unknown platform", () => {
    expect(() => resolveTrigger("nope", "on_init", map)).toThrow(
      /trigger map entry/,
    );
  });

  it("de-duplicates triggers when resolving an agent", () => {
    const out = resolveAgentTriggers(
      ["on_init", "on_init", "on_commit"],
      "claude-code",
      map,
    );
    expect(out.map((r) => r.trigger)).toEqual(["on_init", "on_commit"]);
  });
});
