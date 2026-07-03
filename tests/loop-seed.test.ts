import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assembleSeed, renderSeed, findBrainCompact } from "../src/loop/seed.js";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "harness-seed-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
  delete process.env.HARNESS_BRAIN_PATH;
});

async function write(rel: string, contents: string) {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, contents, "utf8");
}

describe("north-star resolution (invariant seed)", () => {
  it("prefers .harness/SEED.md verbatim over README", async () => {
    await write(".harness/SEED.md", "GOAL: ship the widget with zero regressions.");
    await write("README.md", "# Repo\n\nsome readme text");
    const seed = await assembleSeed({ root });
    expect(seed.northStar.source).toBe(".harness/SEED.md");
    expect(seed.northStar.text).toContain("ship the widget");
  });

  it("falls back to the newest specs/<n>/spec.md", async () => {
    await write("specs/001-first/spec.md", "first spec");
    await write("specs/002-second/spec.md", "second spec — the current one");
    const seed = await assembleSeed({ root });
    expect(seed.northStar.source).toBe("specs/002-second/spec.md");
    expect(seed.northStar.text).toContain("current one");
  });

  it("keeps only the first section of a README fallback", async () => {
    await write("README.md", "# Title\n\nintro line\n\n## Second\n\nshould be dropped");
    const seed = await assembleSeed({ root });
    expect(seed.northStar.source).toBe("README.md");
    expect(seed.northStar.text).toContain("intro line");
    expect(seed.northStar.text).not.toContain("should be dropped");
  });

  it("emits an instructive placeholder when no source exists", async () => {
    const seed = await assembleSeed({ root });
    expect(seed.northStar.source).toBe("(none found)");
    expect(seed.northStar.text).toContain("SEED.md");
  });
});

describe("brain as loop-state (current-state digest)", () => {
  async function makeBrain(repo: string, files: Record<string, string>) {
    const brain = await fs.mkdtemp(path.join(os.tmpdir(), "harness-brain-"));
    const brainDir = path.join(brain, "projects", "brain-1");
    await fs.mkdir(path.join(brainDir, repo), { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      await fs.writeFile(path.join(brainDir, name), body, "utf8");
    }
    return brain;
  }

  it("finds the repo's brain and reads the NEWEST compact rollup", async () => {
    const brain = await makeBrain("ledger-api", {
      "26-06-05-HAR-compact.md": "# older",
      "26-06-07-HAR-compact.md": "# newest\n- abc123 — did a thing",
    });
    const found = await findBrainCompact(brain, "ledger-api");
    expect(found?.source).toBe("brain-1/26-06-07-HAR-compact.md");
    expect(found?.text).toContain("did a thing");
    await fs.rm(brain, { recursive: true, force: true });
  });

  it("injects brain state via HARNESS_BRAIN_PATH", async () => {
    const brain = await makeBrain("myrepo", {
      "26-06-07-HAR-compact.md": "# state\n- deadbee — latest change",
    });
    process.env.HARNESS_BRAIN_PATH = brain;
    const seed = await assembleSeed({ root, repoName: "myrepo" });
    expect(seed.currentState.text).toContain("latest change");
    await fs.rm(brain, { recursive: true, force: true });
  });

  it("degrades gracefully when no brain is configured", async () => {
    const seed = await assembleSeed({ root, repoName: "whatever" });
    expect(seed.currentState.text).toContain("No brain state yet");
  });

  it("degrades when the repo has no folder in the brain", async () => {
    const brain = await makeBrain("other-repo", {
      "26-06-07-HAR-compact.md": "# state",
    });
    const found = await findBrainCompact(brain, "absent-repo");
    expect(found).toBeNull();
    await fs.rm(brain, { recursive: true, force: true });
  });
});

describe("renderSeed", () => {
  it("renders all four planes with source attributions", async () => {
    await write(".harness/SEED.md", "north star goal");
    const md = renderSeed(await assembleSeed({ root }));
    expect(md).toContain("# Harness iteration seed");
    expect(md).toContain("North star (invariant)");
    expect(md).toContain("Current state (from harness-brain)");
    expect(md).toContain("Guardrails (stop / continue)");
    expect(md).toContain("Fresh context");
    // The verification pair is the stop/continue signal.
    expect(md).toContain("verifier-agent");
    expect(md).toContain("drift-reviewer-agent");
    // Hard-limit and fresh-context guardrails are present.
    expect(md).toContain("HARD LIMITS");
    expect(md).toContain("web_search + Context7");
  });
});
