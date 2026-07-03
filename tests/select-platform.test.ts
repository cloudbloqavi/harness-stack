import { describe, it, expect } from "vitest";
import { parseSelection } from "../src/commands/select-platform.js";

const ids = ["claude-code", "antigravity", "codex", "cursor", "copilot"];

describe("parseSelection (multi-platform choice)", () => {
  it("parses multiple numbers separated by comma or space", () => {
    expect(parseSelection("1,4", ids)).toEqual(["claude-code", "cursor"]);
    expect(parseSelection("1 4", ids)).toEqual(["claude-code", "cursor"]);
  });

  it("accepts platform ids", () => {
    expect(parseSelection("cursor, copilot", ids)).toEqual(["cursor", "copilot"]);
  });

  it("supports mixed numbers and ids, de-duplicated", () => {
    expect(parseSelection("1 claude-code cursor", ids)).toEqual([
      "claude-code",
      "cursor",
    ]);
  });

  it('expands "all"', () => {
    expect(parseSelection("all", ids)).toEqual(ids);
  });

  it("defaults to the first platform on empty input", () => {
    expect(parseSelection("", ids)).toEqual(["claude-code"]);
  });

  it("ignores invalid tokens", () => {
    expect(parseSelection("99 nope cursor", ids)).toEqual(["cursor"]);
  });
});
