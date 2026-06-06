#!/usr/bin/env node
/** Harness CLI entrypoint. */
import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runBuildAgents } from "./commands/build-agents.js";
import { runAgentList, runAgentCreate } from "./commands/agent.js";
import { runCheck } from "./commands/check.js";
import { listPlatforms } from "./adapters/registry.js";
import { log } from "./util/log.js";

const DEFAULT_PLATFORM = process.env.HARNESS_PLATFORM ?? "claude-code";

const program = new Command();
program
  .name("harness")
  .description(
    "AI-native, platform-agnostic engineering harness. Spec-driven sub-agents " +
      "you can drop into any project and run on any agentic coding platform.",
  )
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold .subagents/, .harness/ config, and the foundation.")
  .option("-p, --platform <platform>", `target platform (${listPlatforms().join("|")})`, DEFAULT_PLATFORM)
  .option("-y, --yes", "assume yes for all consent prompts", false)
  .option("--skip-foundation", "skip Spec Kit + Superpowers install", false)
  .option("--dry-run-foundation", "print foundation commands without running", false)
  .action(async (o) => {
    await runInit({
      root: process.cwd(),
      platform: o.platform,
      assumeYes: o.yes,
      skipFoundation: o.skipFoundation,
      dryRunFoundation: o.dryRunFoundation,
    });
  });

program
  .command("build-agents")
  .description("Generate platform-native agent files from .subagents/*.yaml.")
  .option("-p, --platform <platform>", `target platform (${listPlatforms().join("|")})`, DEFAULT_PLATFORM)
  .action(async (o) => {
    await runBuildAgents({ root: process.cwd(), platform: o.platform });
  });

const agent = program.command("agent").description("Manage sub-agents.");
agent
  .command("list")
  .description("Print (and refresh) the .subagents/README.md index.")
  .action(async () => {
    await runAgentList(process.cwd());
  });
agent
  .command("create <task...>")
  .description("Discover-or-create an agent for a task (consent-gated).")
  .option("-g, --goal <goal>", "single-sentence goal for the agent")
  .option("-y, --yes", "assume yes for all consent prompts", false)
  .action(async (taskParts: string[], o) => {
    await runAgentCreate({
      root: process.cwd(),
      task: taskParts.join(" "),
      goal: o.goal,
      assumeYes: o.yes,
    });
  });

program
  .command("check")
  .description("Compute the resource-aware orchestration plan for checks.")
  .option("--all", "include all on_check + on_demand reviewers", false)
  .action(async (o) => {
    await runCheck({ root: process.cwd(), all: o.all });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
