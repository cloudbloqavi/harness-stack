import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { parseSubagent, type Subagent } from "../src/schema.js";
import { buildRoster } from "../src/build.js";
import { collectBaseMcpNames } from "../src/project.js";
import type { ModelMap } from "../src/resolution/model-resolver.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const tplDir = path.join(here, "..", "templates");

async function loadTemplateAgents(): Promise<Subagent[]> {
  const dir = path.join(tplDir, "agents");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".yaml"));
  const agents: Subagent[] = [];
  for (const f of files) {
    const raw = YAML.parse(await fs.readFile(path.join(dir, f), "utf8"));
    agents.push(parseSubagent(raw, f));
  }
  return agents;
}

async function loadModelMap(): Promise<ModelMap> {
  return YAML.parse(await fs.readFile(path.join(tplDir, "model-map.yaml"), "utf8"));
}

describe("v1 agent templates", () => {
  it("all parse against the canonical schema", async () => {
    const agents = await loadTemplateAgents();
    expect(agents.length).toBe(7);
    expect(agents.map((a) => a.name).sort()).toEqual([
      "commit-brain-agent",
      "dependency-audit-agent",
      "harness-init-agent",
      "mcp-router-agent",
      "skills-router-agent",
      "spec-author-agent",
      "test-author-agent",
    ]);
  });
});

describe("buildRoster across platforms (R3, R5, R7 acceptance)", () => {
  it("produces a valid roster on claude-code, antigravity, and codex with zero edits", async () => {
    const agents = await loadTemplateAgents();
    const modelMap = await loadModelMap();
    const baseMcpNames = collectBaseMcpNames(agents);

    for (const platform of ["claude-code", "antigravity", "codex"]) {
      const report = buildRoster(agents, { platform, modelMap, baseMcpNames });
      expect(report.errors, `errors on ${platform}: ${report.errors.join("; ")}`).toEqual([]);
      expect(report.results.length).toBe(7);
      for (const r of report.results) {
        expect(r.file.contents.length).toBeGreaterThan(0);
        expect(r.file.relPath).toContain(r.agent.name);
      }
    }
  });

  it("updating model-map changes resolved models without touching agent specs", async () => {
    const agents = await loadTemplateAgents();
    const baseMcpNames = collectBaseMcpNames(agents);
    const modelMap: ModelMap = {
      "claude-code": { fast: "FAST-X", reasoning: "REASON-X", deep: "DEEP-X", inherit: "inherit" },
    };
    const report = buildRoster(agents, { platform: "claude-code", modelMap, baseMcpNames });
    const initFile = report.results.find((r) => r.agent.name === "harness-init-agent")!;
    expect(initFile.file.contents).toContain("REASON-X");
  });
});
