/**
 * `harness init` (spec R1, R5, R8).
 *
 * Creates `.subagents/` with the five v1 agents + auto README, installs
 * Context7 as a base MCP, writes `.harness/model-map.yaml` + allowlists,
 * appends the operating-rules fragment to AGENTS.md, and (consent-gated)
 * installs the Spec Kit + Superpowers foundation. Re-runs never overwrite
 * user edits — existing files are preserved.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { projectPaths, loadSubagents } from "../project.js";
import { templatesDir } from "../templates.js";
import {
  ensureDir,
  listFiles,
  pathExists,
  writeIfAbsent,
} from "../util/fsx.js";
import { renderSubagentsReadme } from "../readme.js";
import { confirm, isApproved } from "../util/consent.js";
import { log } from "../util/log.js";
import { installSpecKit } from "../foundation/spec-kit.js";
import { installSuperpowers } from "../foundation/superpowers.js";
import { listPlatforms } from "../adapters/registry.js";

export interface InitOptions {
  root: string;
  platform: string;
  assumeYes?: boolean;
  /** Skip the Spec Kit / Superpowers subprocess installs. */
  skipFoundation?: boolean;
  dryRunFoundation?: boolean;
}

async function detectProjectType(
  root: string,
): Promise<"greenfield" | "brownfield"> {
  const entries = await fs.readdir(root).catch(() => []);
  const codeish = entries.filter(
    (e) =>
      !e.startsWith(".") &&
      !["README.md", "LICENSE", "node_modules"].includes(e),
  );
  return codeish.length === 0 ? "greenfield" : "brownfield";
}

async function copyTemplateAgents(
  tplDir: string,
  destDir: string,
): Promise<{ written: string[]; skipped: string[] }> {
  await ensureDir(destDir);
  const files = await listFiles(path.join(tplDir, "agents"), ".yaml");
  const written: string[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    const dest = path.join(destDir, path.basename(f));
    const contents = await fs.readFile(f, "utf8");
    if (await writeIfAbsent(dest, contents)) written.push(path.basename(f));
    else skipped.push(path.basename(f));
  }
  return { written, skipped };
}

export async function runInit(opts: InitOptions): Promise<void> {
  const paths = projectPaths(opts.root);
  if (!listPlatforms().includes(opts.platform)) {
    throw new Error(
      `Unknown platform "${opts.platform}". Known: ${listPlatforms().join(", ")}.`,
    );
  }

  const projectType = await detectProjectType(opts.root);
  log.step(`Harness init — ${projectType} project, platform=${opts.platform}`);

  const tplDir = await templatesDir();

  // 1. .subagents/ + v1 agents (never overwrite).
  log.step("1. Sub-agents");
  const { written, skipped } = await copyTemplateAgents(
    tplDir,
    paths.subagentsDir,
  );
  written.forEach((f) => log.ok(`wrote .subagents/${f}`));
  skipped.forEach((f) => log.detail(`kept existing .subagents/${f}`));

  // 2. .harness/ config: model-map + allowlists (never overwrite).
  log.step("2. Harness config");
  await ensureDir(paths.harnessDir);
  if (
    await writeIfAbsent(
      paths.modelMap,
      await fs.readFile(path.join(tplDir, "model-map.yaml"), "utf8"),
    )
  )
    log.ok("wrote .harness/model-map.yaml");
  else log.detail("kept existing .harness/model-map.yaml");

  await ensureDir(paths.allowlistsDir);
  for (const name of ["skills.yaml", "mcp-servers.yaml"]) {
    const dest = path.join(paths.allowlistsDir, name);
    if (
      await writeIfAbsent(
        dest,
        await fs.readFile(path.join(tplDir, "allowlists", name), "utf8"),
      )
    )
      log.ok(`wrote .harness/allowlists/${name}`);
    else log.detail(`kept existing .harness/allowlists/${name}`);
  }

  // 3. README index (always regenerated from current specs).
  const agents = await loadSubagents(opts.root);
  await fs.writeFile(paths.readme, renderSubagentsReadme(agents), "utf8");
  log.ok("regenerated .subagents/README.md");

  // 4. AGENTS.md operating-rules fragment (append once).
  log.step("3. AGENTS.md operating rules");
  await appendAgentsFragment(opts.root, tplDir);

  // 5. Foundation install (consent-gated subprocesses).
  log.step("4. Spec-driven foundation");
  if (opts.skipFoundation) {
    log.detail("skipped (--skip-foundation)");
  } else {
    await installFoundation(opts, projectType);
  }

  log.step("Done.");
  log.info("Next: `harness build-agents` to generate platform agent files.");
}

async function appendAgentsFragment(
  root: string,
  tplDir: string,
): Promise<void> {
  const fragment = await fs.readFile(
    path.join(tplDir, "AGENTS.fragment.md"),
    "utf8",
  );
  const agentsMd = path.join(root, "AGENTS.md");
  if (!(await pathExists(agentsMd))) {
    await fs.writeFile(agentsMd, `# AGENTS\n\n${fragment}`, "utf8");
    log.ok("created AGENTS.md with Harness operating rules");
    return;
  }
  const current = await fs.readFile(agentsMd, "utf8");
  if (current.includes("<!-- HARNESS:BEGIN")) {
    log.detail("AGENTS.md already contains the Harness fragment");
    return;
  }
  await fs.writeFile(agentsMd, `${current.trimEnd()}\n\n${fragment}`, "utf8");
  log.ok("appended Harness operating rules to AGENTS.md");
}

async function installFoundation(
  opts: InitOptions,
  projectType: "greenfield" | "brownfield",
): Promise<void> {
  const consent = await confirm(
    "Install the spec-driven foundation (Spec Kit + Superpowers)?",
    { assumeYes: opts.assumeYes, projectRoot: opts.root, key: "foundation" },
  );
  if (!isApproved(consent)) {
    log.detail("foundation install declined — parked");
    return;
  }

  const projectName = path.basename(path.resolve(opts.root));
  const specKit = await installSpecKit(projectType, opts.platform, {
    cwd: opts.root,
    projectName,
    dryRun: opts.dryRunFoundation,
  });
  specKit.ok
    ? log.ok(`Spec Kit: ${specKit.message}`)
    : log.warn(`Spec Kit: ${specKit.message}`);

  const sp = await installSuperpowers(opts.platform, {
    cwd: opts.root,
    dryRun: opts.dryRunFoundation,
  });
  log.ok(`Superpowers (${sp.level}): ${sp.message}`);
}
