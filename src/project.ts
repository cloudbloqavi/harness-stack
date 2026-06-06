/** Project layout + loaders for the harness control files. */
import path from "node:path";
import { parseSubagent, type Subagent } from "./schema.js";
import type { ModelMap } from "./resolution/model-resolver.js";
import { listFiles, pathExists, readYaml } from "./util/fsx.js";

export interface ProjectPaths {
  root: string;
  subagentsDir: string;
  harnessDir: string;
  modelMap: string;
  allowlistsDir: string;
  readme: string;
}

export function projectPaths(root: string): ProjectPaths {
  return {
    root,
    subagentsDir: path.join(root, ".subagents"),
    harnessDir: path.join(root, ".harness"),
    modelMap: path.join(root, ".harness", "model-map.yaml"),
    allowlistsDir: path.join(root, ".harness", "allowlists"),
    readme: path.join(root, ".subagents", "README.md"),
  };
}

/** Load and validate every `.subagents/*.yaml` (excluding README). */
export async function loadSubagents(root: string): Promise<Subagent[]> {
  const { subagentsDir } = projectPaths(root);
  const files = await listFiles(subagentsDir, ".yaml");
  const agents: Subagent[] = [];
  for (const file of files) {
    const raw = await readYaml(file);
    agents.push(parseSubagent(raw, path.relative(root, file)));
  }
  return agents;
}

export async function loadModelMap(root: string): Promise<ModelMap> {
  const { modelMap } = projectPaths(root);
  if (!(await pathExists(modelMap))) {
    throw new Error(
      `Missing .harness/model-map.yaml. Run \`harness init\` first.`,
    );
  }
  return readYaml<ModelMap>(modelMap);
}

/** Names of base MCP servers (e.g. context7) declared across all agents. */
export function collectBaseMcpNames(agents: Subagent[]): Set<string> {
  const names = new Set<string>();
  for (const agent of agents) {
    for (const srv of agent.mcp_servers) {
      if (srv.base) names.add(srv.name);
    }
  }
  // Context7 is installed as a base MCP at init regardless of per-agent decls.
  names.add("context7");
  return names;
}
