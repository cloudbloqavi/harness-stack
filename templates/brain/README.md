# Harness Brain

**The shared commit-memory for projects managed by [Harness Stack](https://github.com/cloudbloqavi/harness-stack).**

Harness Brain is a plain-Markdown, git-backed memory of *what changed and why*
across every project in your ecosystem. The `commit-brain-agent` writes a
detailed per-repo log here on each commit and rolls it up into a compact
per-brain digest; the `cross-repo-discovery-agent` reads those at session start
to surface a recent-change digest across a project and its related repos.

It is intentionally simple: human-readable Markdown, no database, no service —
just a repo you can grep, diff, and read.

## Brains: how repos are grouped

A **brain** is a numbered folder under `projects/` that groups repositories.

- **Related repos share one brain.** A product split across several
  repositories (e.g. an API + its web client) puts all of those repos inside the
  **same** brain. The grouping is what marks them related, so the
  `cross-repo-discovery-agent` reads them **together**.
- **Unrelated repos each get their own brain.** Independent projects live in
  **separate** numbered brains (`brain-2`, `brain-3`, …) and are digested in
  isolation.

| Scenario | Example | What it shows |
| --- | --- | --- |
| **Related** — one product, many repos | [`brain-1/`](projects/brain-1) → `ledger-api` + `ledger-web` | Two repos of one product (Ledger) in **one** brain; `web` depends on `api`, read together. |
| **Unrelated** — independent repos | [`brain-2/`](projects/brain-2) `weather-cli`, [`brain-3/`](projects/brain-3) `markdown-linter` | Each unrelated repo in its **own** numbered brain. |

## Files: detailed logs vs the compact rollup

Each brain holds two kinds of file:

- **Detailed per-repo log** — one folder per repo, with dated detailed entries
  `YY-MM-DD-HAR.md`. Full content: what/why/files/cross-repo impact/flags. This
  is the source of record, appended per commit.
- **Compact brain rollup** — a **single** file at the brain root,
  `YY-MM-DD-HAR-compact.md`, regenerated daily. It is structured by project and
  carries the compacted, one-line-per-change view across the whole brain.

All dates are **fully numeric**: `YY-MM-DD` (e.g. `26-06-07` = 2026-06-07).

### The two files map onto agentic-loop state

The split is not just tidiness — it is what lets the brain act as a loop's
externalized **state**:

- The **compact rollup** is the *current-state digest*: small and current, it is
  what `harness seed` re-injects at the start of each loop iteration ("read the
  current state of the work before acting").
- The **detailed log** is the *audit trail*: the append-only record that closes
  the "quiet success" gap — read when a human needs the full why, never fed into
  the iteration seed.

See `harness-stack/docs/agentic-loop.md` for how the seed and verification gate
use these.

```
   project repo (on_commit)                          new session start
          |                                                  |
          v                                                  v
  +-------------------+                            +---------------------------+
  | commit-brain-     |   detailed log +           | cross-repo-discovery-     |
  |   agent           |   compact rollup           |   agent                   |
  +-------------------+--------------+             +-------------+-------------+
                                     v                           ^
                +-----------------------------------+    | read recent digest
                |            harness-brain           |    | across the brain
                |  projects/<brain>/                 |----+ (related repos
                |    <YY-MM-DD>-HAR-compact.md  (1×)  |      read together)
                |    <repo>/<YY-MM-DD>-HAR.md         |
                +-----------------------------------+
                  (located via HARNESS_BRAIN_PATH)
```

## Layout

```
harness-brain/
├── README.md
├── _templates/
│   ├── YY-MM-DD-HAR.md            ← detailed per-repo entry format
│   └── YY-MM-DD-HAR-compact.md    ← brain-level compact rollup format
└── projects/
    ├── brain-1/                       ← RELATED repos (one product) share a brain
    │   ├── README.md                  ← brain index: product + member repos
    │   ├── 26-06-07-HAR-compact.md    ← single daily compact rollup (all repos)
    │   ├── ledger-api/
    │   │   ├── README.md
    │   │   └── 26-06-07-HAR.md        ← detailed log
    │   └── ledger-web/
    │       ├── README.md
    │       └── 26-06-07-HAR.md
    ├── brain-2/                       ← UNRELATED repo → its own brain
    │   ├── README.md
    │   ├── 26-06-05-HAR-compact.md
    │   └── weather-cli/
    │       ├── README.md
    │       └── 26-06-05-HAR.md
    └── brain-3/                       ← another UNRELATED repo → another brain
        ├── README.md
        ├── 26-06-03-HAR-compact.md
        └── markdown-linter/
            ├── README.md
            └── 26-06-03-HAR.md
```

- **One brain per group of related repos**, numbered `brain-1`, `brain-2`, …
- **One folder per repo** inside its brain, named after the repo.
- **Detailed logs** are `YY-MM-DD-HAR.md` per repo; multiple commits on the same
  day append to that day's file.
- **One compact rollup** per brain, `YY-MM-DD-HAR-compact.md`, regenerated daily.
- Brains, repo folders, and READMEs are bootstrapped on a repo's first commit.

## Entry format

See [`_templates/YY-MM-DD-HAR.md`](_templates/YY-MM-DD-HAR.md) for the detailed
per-repo entry and [`_templates/YY-MM-DD-HAR-compact.md`](_templates/YY-MM-DD-HAR-compact.md)
for the brain rollup. The worked examples under [`projects/`](projects/) show
both the related-repos and unrelated-repos cases end to end.

## How it is written

The `commit-brain-agent` (defined in `harness-stack/.subagents/`) runs on
`on_commit`, reads the diff + commit message, appends a detailed entry to the
repo's `YY-MM-DD-HAR.md`, and refreshes its brain's `YY-MM-DD-HAR-compact.md`
rollup. It is designed to **never block a commit** — on any error it logs to
stderr and exits 0.

Point the agent at this repo with the `HARNESS_BRAIN_PATH` environment variable:

```bash
export HARNESS_BRAIN_PATH=/path/to/harness-brain
```

## How it is read

The `cross-repo-discovery-agent` runs at session start. For the current repo it
locates the repo's brain, reads the recent compact rollup plus the detailed logs
of every repo in that brain (related repos, read together), and produces a
digest. A repo in its own brain is digested in isolation.
