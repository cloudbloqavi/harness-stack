# Harness Stack

**An AI-native, platform-agnostic engineering harness.** Drop it into any
project and get a spec-driven sub-agent system that runs on any agentic coding
platform — Claude Code, Antigravity, Codex, and more — with zero hand-wiring.

Harness Stack is an open-source framework. An engineer runs `harness init` and
gets a working, auditable, fresh-context-grounded agent harness in their repo.

---

## Why

Sub-agents are the execution engine behind every automated check, routing
decision, and commit-memory write in a modern AI-assisted workflow. Harness
makes them:

- **Platform-agnostic by construction.** No agent spec names a concrete model
  or a platform-specific tool. Agents declare an abstract **model tier** and
  abstract **capabilities**; the active platform adapter resolves them.
- **Fresh-context by mandate.** Any agent that reasons about libraries, APIs,
  versions, or CVEs runs with web search + **Context7** wired — never stale
  training data.
- **Spec-driven by default.** Harness installs vetted foundations (**Spec Kit**
  and **Superpowers**) and surfaces their skills through a consent-gated
  recommendation protocol.
- **Auditable.** Every sub-agent is a diffable `.yaml` in `.subagents/`.

## Install

```bash
npm install        # in this repo
npm run build      # produces dist/ + the `harness` bin
```

Or run from source without building:

```bash
npm run harness -- <command>     # e.g. npm run harness -- init
```

## Quick start

```bash
harness init                       # asks your platform, scaffolds .subagents/ + .harness/ + foundation
harness build-agents               # generate platform-native agent files
harness agent list                 # browse the registered sub-agents
harness hooks                      # trigger -> native event-hook wiring plan
harness check --all                # see the resource-aware orchestration plan
```

`harness init` asks which agentic platform you use — Claude Code, Antigravity,
Codex, Cursor, or Copilot. Pass `--platform <id>` (or set `HARNESS_PLATFORM`) to
skip the prompt; `build-agents` / `hooks` default to `claude-code`.

## Architecture

```
                         +------------------------------+
                         |        harness CLI           |
                         |  init · build-agents · agent |
                         |         · check              |
                         +---------------+--------------+
                                         |
              +--------------------------+--------------------------+
              v                          v                          v
   +---------------------+   +-----------------------+   +---------------------+
   |   .subagents/*.yaml |   |  .harness/            |   |  AGENTS.md          |
   |  (source of truth)  |   |   model-map.yaml      |   |  (operating rules:  |
   |  name, tier,        |   |   trigger-map.yaml    |   |   fresh-context for  |
   |  capabilities,      |   |   allowlists/*.yaml   |   |   the main agent)   |
   |  triggers, prompt   |   |   consent.json        |   +---------------------+
   +----------+----------+   +-----------+-----------+
              |                          |
              |   harness build-agents   |
              v                          v
   +-------------------------------------------------------------+
   |                    RESOLUTION PIPELINE                       |
   |                                                             |
   |   model_tier  --[ model-map ]--->  concrete model           |
   |   capabilities --[ adapter ]---->  native tools             |
   |   triggers    --[ trigger-map ]->  native hooks / fallback  |
   |   requires_fresh_context ------->  assert web_search+Context7|
   |                              (else: fail with clear error)  |
   +------------------------------+------------------------------+
                                  |
       +----------+----------+----+-----+----------+-----------+
       v          v          v          v          v
  +---------+ +----------+ +-------+ +--------+ +---------+
  | Claude  | |Antigravity| | Codex | | Cursor | | Copilot |
  | Code    | | .anti...  | |.codex/| |.cursor/| |.github/ |
  |.claude/ | | agents/   | |agents/| |agents/ | |copilot/ |
  +---------+ +----------+ +-------+ +--------+ +---------+
       \_______ trigger -> native hook (or git-hook / harness fallback) ______/

   Orchestrator (harness check) reads the same specs and computes a
   resource-aware parallel batch: CPU cap + 70% memory budget + priority.

   Agent artifacts:
     commit-brain-agent        --writes--> harness-brain   (per-commit memory)
     cross-repo-discovery-agent --reads--> harness-brain   (session digest)
     dependency-audit-agent    --writes--> DEPENDENCIES.md (latest/EOL/deprecated)
     test-author-agent         --writes--> test files      (consent-gated)
```

## Agent roster (by trigger)

```
   on_init ───────────────┐   project start (greenfield & brownfield)
     harness-init-agent    |   classify, gap report, install base tooling
     spec-author-agent     |   Spec Kit: constitution -> spec -> plan -> tasks
     dependency-audit-agent|   build/refresh DEPENDENCIES.md
                           |
   on_demand ─────────────┤   you ask, or the orchestrator routes a task
     skills-router-agent   |   rank skills (consent-gated)
     mcp-router-agent      |   rank MCP servers (consent-gated)
     dependency-audit-agent|   re-audit dependencies on request
     test-author-agent     |   review tests; author missing ones (on consent)
                           |
   on_check ──────────────┤   harness check [--all]
     test-author-agent     |   coverage/quality review
                           |
   on_commit ─────────────┘   git commit hook
     commit-brain-agent    |   summarise the diff into harness-brain
```

## How it works

```
.subagents/<agent>.yaml      <- canonical, platform-agnostic source of truth
        |  harness build-agents
        v
.claude/agents/<agent>.md          <- Claude Code   (derived)
.antigravity/agents/*.md           <- Antigravity   (derived)
.codex/agents/*.json               <- Codex         (derived)
.cursor/agents/*.md                <- Cursor        (derived)
.github/copilot/agents/*.md        <- Copilot       (derived)
```

- **Edit the YAML, not the generated files.** Generated files are overwritten on
  every build.
- **Model names live in one place** — `.harness/model-map.yaml`. Agents declare
  a `model_tier` (`fast` / `reasoning` / `deep` / `inherit`); the adapter
  substitutes the concrete model per platform. Update the map, nothing else
  changes.
- **Capabilities are abstract** (`read` / `write` / `exec` / `web_search` /
  `web_fetch`). The adapter maps them to native tools.
- **Triggers are abstract** (`on_init` / `on_commit` / `on_check` /
  `on_demand`); see below.

### Triggers → native event hooks

Different platforms expose different event hooks. Agents declare abstract
triggers, and `.harness/trigger-map.yaml` resolves each to the active platform's
**native hook** — or, where the platform has no equivalent, to a Harness
fallback (an installed **git hook** for `on_commit`, or `harness check` for
`on_check`). Run `harness hooks` to see the wiring plan.

Because hook APIs drift, the map ships with best-known defaults flagged
`verified: false`; at `init` the `harness-init-agent` **researches the chosen
platform's current hook docs** (search + Context7) and refreshes the map before
wiring. This is why `init` asks which platform you use first.

### Fresh-context enforcement

Any agent with `requires_fresh_context: true` must resolve a web-search tool
**and** have Context7 available, or `harness build-agents` fails with an
actionable error. Context7 is installed as a base MCP at `init`, and the
operating-rules fragment written into `AGENTS.md` extends the rule to the main
agent.

### Discovery & reuse

`harness agent create <task>` follows reuse-before-create:

1. **Exact match** by name -> reuse.
2. **Similar match** (overlap score >= 0.75) -> offer to reuse/extend.
3. **Create new** -> consent-gated scaffold, then regenerate the README index.

### Resource-aware orchestration

`harness check` computes the parallel batch: CPU cap (`cores - 1`), a 70%
free-memory budget (per-agent `max_memory_mb` hints, 256 MB default),
high-priority first, non-parallelizable agents sequenced.

## The v1 agent catalog

| Agent | Tier | Purpose |
| --- | --- | --- |
| `harness-init-agent` | reasoning | Classify project, gap report, install base tooling |
| `spec-author-agent` | reasoning | Drive Spec Kit constitution -> spec -> plan -> tasks |
| `skills-router-agent` | fast | Rank skills across sources, consent-gated |
| `mcp-router-agent` | fast | Rank MCP servers from the curated allowlist |
| `commit-brain-agent` | fast | Write per-commit summaries into `harness-brain` |
| `dependency-audit-agent` | reasoning | Maintain `DEPENDENCIES.md` (latest / outdated / deprecated / EOL) from live data |
| `test-author-agent` | reasoning | Review unit tests, surface gaps, author missing tests on consent |

See [`docs/spec-subagents.md`](docs/spec-subagents.md) for the full design spec
and the Phase 2/3 catalog.

## Development

```bash
npm run typecheck     # tsc --noEmit
npm test              # vitest
npm run build         # compile to dist/
```

## License

MIT — see [LICENSE](LICENSE).
