/**
 * `harness build-agents` (spec R7).
 *
 * Regenerates platform-native agent files from `.subagents/*.yaml` for the
 * active platform. Enforces fresh-context + model resolution; if any agent
 * fails, the whole build fails with one clear, complete error message.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  loadModelMap,
  loadSubagents,
  collectBaseMcpNames,
} from "../project.js";
import { buildRoster } from "../build.js";
import { ensureDir } from "../util/fsx.js";
import { log } from "../util/log.js";

export interface BuildAgentsOptions {
  root: string;
  platform: string;
}

export async function runBuildAgents(
  opts: BuildAgentsOptions,
): Promise<{ written: number }> {
  const agents = await loadSubagents(opts.root);
  if (agents.length === 0) {
    log.warn("No .subagents/*.yaml found. Run `harness init` first.");
    return { written: 0 };
  }
  const modelMap = await loadModelMap(opts.root);
  const baseMcpNames = collectBaseMcpNames(agents);

  const report = buildRoster(agents, {
    platform: opts.platform,
    modelMap,
    baseMcpNames,
  });

  if (report.errors.length > 0) {
    log.error(`Build failed for platform "${opts.platform}":`);
    report.errors.forEach((e) => log.detail(`- ${e}`));
    throw new Error(
      `${report.errors.length} agent(s) failed to build. Fix the above and retry.`,
    );
  }

  log.step(`Building ${report.results.length} agent(s) for ${opts.platform}`);
  for (const r of report.results) {
    const dest = path.join(opts.root, r.file.relPath);
    await ensureDir(path.dirname(dest));
    await fs.writeFile(dest, r.file.contents, "utf8");
    log.ok(`${r.agent.name} → ${r.file.relPath}`);
    r.warnings.forEach((w) => log.warn(`  ${w}`));
  }
  return { written: report.results.length };
}
