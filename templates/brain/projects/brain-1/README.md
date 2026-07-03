# brain-1 — Ledger (related repos)

> **Scenario: related repos share ONE brain.** Everything in this brain belongs
> to a single product (**Ledger**) that is split across multiple repositories.
> Grouping the related repos under the same numbered brain is what tells the
> `cross-repo-discovery-agent` to read them **together**.

**Product:** Ledger
**Repos in this brain (related):**
- [`ledger-api/`](ledger-api) — backend service
- [`ledger-web/`](ledger-web) — web client; **depends on** `ledger-api`

**Brain compact:** [`26-06-07-HAR-compact.md`](26-06-07-HAR-compact.md) — the
single, daily-regenerated rollup across both repos in compact form. Full detail
lives in each repo's own `<YY-MM-DD>-HAR.md` log.
