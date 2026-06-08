# projects/ — brains index

Each subfolder here is a **brain**: a numbered folder that groups repositories.
The rule is simple:

- **Related repos share one brain** — read together as a single cross-repo digest.
- **Unrelated repos each get their own brain** — digested in isolation.

See the [top-level README](../README.md) for the full format (detailed per-repo
logs vs. the single per-brain compact rollup, and the `YY-MM-DD` naming).

| Brain | Scenario | Repos | Illustrates |
| --- | --- | --- | --- |
| [`brain-1/`](brain-1) | **Related** — one product, many repos | `ledger-api`, `ledger-web` | Two repos of one product (Ledger) in **one** brain; `web` depends on `api`, with cause-and-effect spanning both same-day logs. Also shows two commits appended to one day's detailed log. |
| [`brain-2/`](brain-2) | **Unrelated** — standalone repo | `weather-cli` | An independent repo in its **own** numbered brain. |
| [`brain-3/`](brain-3) | **Unrelated** — standalone repo | `markdown-linter` | A second independent repo → a second brain, showing how multiple brains coexist. |

> These are worked examples with dummy data. In a real brain the repo folders are
> just your repository names, and brains accrue as you add projects. Folders,
> READMEs, and rollups are bootstrapped automatically by the `commit-brain-agent`
> on a repo's first commit.
