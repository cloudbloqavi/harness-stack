# Spec: Harness Sub-Agent System

**Status:** Draft v0.3 · **Scope:** `harness-stack` · **Type:** Technical design spec + agent catalog

> Model lineups live in a single editable config (`.harness/model-map.yaml`),
> never hardcoded in agent specs. The concrete agent YAMLs referenced below ship
> in [`templates/agents/`](../templates/agents/) and are installed by
> `harness init`.

## Summary

This spec defines how `harness-stack` creates, discovers, reuses, and
orchestrates **sub-agents** — specialized agent instances that execute discrete
harness-engineering tasks without polluting the developer's main conversation.

Three cross-cutting principles govern everything:

1. **Platform-agnostic by construction.** No agent spec names a concrete model
   or platform-specific tool. Agents declare an abstract **model tier** and
   abstract **capabilities**; the active platform adapter resolves them.
2. **Fresh context is mandatory.** Any agent touching docs, libraries, packages,
   security advisories, or "what's current" must use search + up-to-date
   context. Context7 is installed as a base MCP at init.
3. **Spec-driven by default.** Harness installs **Spec Kit** (spec → plan →
   tasks → implement) and **Superpowers** (TDD / contracts / two-stage review)
   at init, surfaced through a consent-gated recommendation protocol.

## Relationship to the official Claude Code format

The official Claude Code sub-agent format stores `.md` files with YAML
frontmatter in `.claude/agents/`. Harness does **not** replace it — it generates
it. `.subagents/*.yaml` is the canonical, richer, platform-agnostic source of
truth; platform agent files are derived artefacts regenerated on every build.

## The `.subagents/` folder

One file per sub-agent, kebab-case, created by `harness init`. `README.md` is an
auto-generated index, regenerated on any add/modify/delete.

### Canonical schema

The authoritative schema is implemented and validated in
[`src/schema.ts`](../src/schema.ts). Required fields: `name`, `description`,
`goal`, `type`, `model_tier`, `capabilities`, `prompt`. Two things make a spec
portable: `model_tier` (not a model name) and `capabilities` (not tool names).

## Platform-agnostic model resolution

Agents declare a tier (`fast` / `reasoning` / `deep` / `inherit`). The adapter
reads [`.harness/model-map.yaml`](../templates/model-map.yaml) and substitutes
the concrete model.

Resolution rules ([`src/resolution/model-resolver.ts`](../src/resolution/model-resolver.ts)):

1. Adapter detects the active platform (launch context or `--platform`).
2. Look up `model_tier` in `model-map.yaml[platform]`.
3. `model_overrides[platform]` wins when present.
4. A missing tier falls back to the next tier **down** with a warning.

**Acceptance:** the *same* `.subagents/*.yaml` set produces a valid roster on
Claude Code, Antigravity, and Codex with zero edits — verified in
[`tests/roster.test.ts`](../tests/roster.test.ts).

## Fresh-context mandate

1. **Platform-native search** — the adapter wires abstract `web_search` to the
   native mechanism (Claude Code `WebSearch`, Antigravity Gemini grounding,
   Codex web tool). See
   [`src/resolution/capability-resolver.ts`](../src/resolution/capability-resolver.ts).
2. **Context7 base MCP** — installed at init so library/doc lookups return
   current, version-specific docs.
3. **Enforcement** — any agent with `requires_fresh_context: true` must resolve
   a search tool AND have Context7, or the build fails with an actionable error
   ([`src/resolution/fresh-context.ts`](../src/resolution/fresh-context.ts)).
4. **Applies to the main agent too** — the `AGENTS.md` fragment written at init
   encodes the rule for the host agent.

## Spec-driven foundation: Spec Kit + Superpowers

Installed at init, consent-gated
([`src/foundation/`](../src/foundation/)):

- **Spec Kit** (`github/spec-kit`) in skills mode. Greenfield runs
  `specify init <project>`; brownfield runs `specify init --here`; both pass
  `--integration <platform> --integration-options="--skills"`. It is a Python
  CLI invoked via `uvx` — `uv` presence is part of the init dependency check.
- **Superpowers** (`obra/superpowers`, MIT). Strongest on Claude Code; partial
  on Codex/Gemini; skipped on OpenCode. Init installs the compatible subset or
  skips with a note — **never fails** the init over it.

### Skill recommendation protocol

No skill runs silently. Every use is surfaced as
(**skill** | **source** | **what** | **why now**) and confirmed
(`y` / `n` / `always-for-project`). Declined skills are parked, not re-prompted
([`src/skills/router.ts`](../src/skills/router.ts),
[`src/util/consent.ts`](../src/util/consent.ts)).

### Skill sourcing precedence

Spec Kit → Superpowers → curated Harness allowlist → Harness-native, with
provenance labelled and currency confirmed via search/Context7.

## Discovery & lifecycle workflow

[`src/discovery/discover.ts`](../src/discovery/discover.ts):

```
            task (CLI / trigger / orchestrator)
                          |
                          v
              +-----------------------+
              | 1. EXACT MATCH?       |   name == task slug
              +-----------+-----------+
                   yes |          | no
                       v          v
                   [ reuse ]  +-----------------------+
                              | 2. SIMILAR MATCH?     |   overlap score >= 0.75
                              +-----------+-----------+
                                   yes |        | no
                                       v        v
                          +------------------+  +-----------------------+
                          | reuse / extend?  |  | 3. CREATE NEW         |
                          | (consent-gated)  |  | scaffold -> consent   |
                          +--------+---------+  | -> write -> README     |
                              no   |            | -> regenerate adapter |
                                   +----------->+-----------------------+
```

1. **Exact match** — `name == task slug` → reuse.
2. **Similar match** — overlap score ≥ 0.75 → offer reuse/extend.
3. **Create new** — consent-gated scaffold → regenerate README + adapter.

**Invariant:** `.subagents/` is never written without developer consent.

## Orchestration & parallelisation

[`src/orchestrator/scheduler.ts`](../src/orchestrator/scheduler.ts) —
`calculateMaxParallel`:

```
   ready agents
        |
        +--> not parallelizable ---------------------> [ run sequentially ]
        |
        +--> parallelizable --> sort by priority (high > normal > low)
                                         |
                                         v
            +--------------------------------------------------------+
            |  fill the batch while BOTH hold:                        |
            |    batch.length < max(1, cpuCount - 1)      (CPU cap)   |
            |    memUsed + agent.mem  <=  freeMemMB * 0.7 (mem cap)   |
            |    (missing max_memory_mb hint => assume 256 MB)        |
            +----------------------------+---------------------------+
                          fits |                | does not fit
                               v                v
                        [ run in batch ]   [ defer to next batch ]

   e.g. 4 cores / 2 GB free -> CPU cap 3, mem budget ~1.4 GB -> <= 3 in parallel
```

1. Candidate pool = parallelizable, ready agents.
2. CPU cap = `max(1, cpuCount - 1)`.
3. Memory cap = accumulate `max_memory_mb` until `freeMemMB * 0.7` (missing hint
   ⇒ 256 MB).
4. Batch = `min(cpu cap, agents fitting in memory)`.
5. High priority first; low priority deferred when capped.

## Sub-agent catalog

### Phase 1 (v1, P0) — shipped in [`templates/agents/`](../templates/agents/)

| Agent | Tier | Trigger | Purpose |
| --- | --- | --- | --- |
| `harness-init-agent` | reasoning | on_init | Classify project, gap report, install base tooling |
| `spec-author-agent` | reasoning | on_init, on_demand | Drive Spec Kit constitution → spec → plan → tasks |
| `skills-router-agent` | fast | on_demand | Rank skills across sources, consent-gated |
| `mcp-router-agent` | fast | on_demand | Rank MCP servers from the curated allowlist |
| `commit-brain-agent` | fast | on_commit | Write per-commit summaries into `harness-brain` |
| `dependency-audit-agent` | reasoning | on_init, on_demand | Maintain `DEPENDENCIES.md`: latest/outdated/deprecated/EOL per package, from live data |

### Phase 2 (P1, should-have)

`doc-coherence-agent`, `code-review-agent`, `security-review-agent`,
`bug-fix-agent`, `cross-repo-discovery-agent`.

### Phase 3 (P2, future)

`architectural-drift-agent`, `scanner-orchestration-agent`,
`model-selection-agent`, `test-generation-agent`, `changelog-agent`.

## Requirements coverage (v1 / P0)

| Req | What | Where |
| --- | --- | --- |
| R1 | `.subagents/` init + v1 agents + README; non-destructive re-runs | `src/commands/init.ts` |
| R2 | Discovery & reuse (exact → similar ≥0.75 → create), consent-gated | `src/discovery/`, `src/commands/agent.ts` |
| R3 | Platform-agnostic model resolution + override + fallback | `src/resolution/model-resolver.ts` |
| R4 | Capability → native tool resolution | `src/resolution/capability-resolver.ts` |
| R5 | Fresh-context enforcement (build fails without search + Context7) | `src/resolution/fresh-context.ts` |
| R6 | Resource-aware spawning | `src/orchestrator/scheduler.ts` |
| R7 | Adapter generation | `src/adapters/`, `src/commands/build-agents.ts` |
| R8 | Spec Kit + Superpowers install, consent-gated | `src/foundation/` |
| R9 | Skill recommendation protocol (y/n/always) | `src/skills/router.ts`, `src/util/consent.ts` |
| R10 | Skill sourcing precedence | `src/skills/router.ts` |

## Open questions (carried from the PRD)

- Similarity scoring: v1 ships a deterministic overlap-coefficient scorer
  (zero-latency, no network); embeddings/LLM are a future swap behind
  `scoreSimilarity`.
- Ownership/freshness of `.harness/allowlists/*` and `model-map.yaml`
  (bundled-and-refreshed vs. fetched); a stale model map silently routes to
  retired models — needs a freshness check.
- Per-platform `web_search` shim vs. uniform interface.
- `commit-brain-agent` debounce (batch commits within 60s).
- `continuous` agents: daemon file-watcher vs. IDE events.
- Dynamic post-spawn memory measurement vs. static `max_memory_mb` hints.
- Spec Kit skills-mode availability per integration; fallback to slash-command
  files when unsupported.
