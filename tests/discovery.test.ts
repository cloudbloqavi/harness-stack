import { describe, it, expect } from "vitest";
import { discover, slugify } from "../src/discovery/discover.js";
import { parseSubagent, type Subagent } from "../src/schema.js";

function mk(name: string, description: string, goal: string): Subagent {
  return parseSubagent({
    name,
    description,
    goal,
    type: "on-demand",
    model_tier: "reasoning",
    capabilities: ["read"],
    prompt: "p",
  });
}

const existing = [
  mk(
    "code-review-agent",
    "Reviews changes for correctness, security, performance, readability, maintainability.",
    "Surface actionable code-quality issues with severity and fix suggestions.",
  ),
  mk(
    "security-review-agent",
    "Scans changes and config for vulnerabilities, exposed secrets, insecure dependencies, OWASP issues.",
    "Identify vulnerabilities and misconfigurations with current remediation guidance.",
  ),
];

describe("discover (R2)", () => {
  it("returns an exact match by name", () => {
    const out = discover({ slug: "code-review-agent", description: "x" }, existing);
    expect(out.kind).toBe("exact");
  });

  it("returns similar matches above the threshold", () => {
    const out = discover(
      {
        slug: "review-the-code",
        description:
          "Review code changes for correctness security performance readability maintainability quality issues",
      },
      existing,
    );
    expect(out.kind).toBe("similar");
    if (out.kind === "similar") {
      expect(out.matches[0]!.agent.name).toBe("code-review-agent");
    }
  });

  it("returns none when nothing is close", () => {
    const out = discover(
      { slug: "translate-docs-to-french", description: "Translate documentation into French language locale" },
      existing,
    );
    expect(out.kind).toBe("none");
  });

  it("slugifies task text", () => {
    expect(slugify("Review the Code!")).toBe("review-the-code");
  });
});
