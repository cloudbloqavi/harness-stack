# Dependencies

> Example output produced by `dependency-audit-agent`. The real file lives at
> the project root as `DEPENDENCIES.md` and is refreshed from live data
> (registry + endoflife.date) on `on_init` and on demand.

_Last reviewed: 2026-06-08 by dependency-audit-agent._

## npm (package.json)

| Package | Current | Latest | Status | EOL | Severity | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| commander | 12.1.0 | 12.1.0 | current | n/a | ok | |
| yaml | 2.5.1 | 2.6.0 | minor-behind | n/a | ok | safe patch/minor bump |
| zod | 3.23.8 | 3.24.x | minor-behind | n/a | ok | |
| request | 2.88.2 | 2.88.2 | deprecated | n/a | critical | unmaintained — migrate to `undici`/`fetch` |

## runtime

| Package | Current | Latest | Status | EOL | Severity | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| node | 18.x | 22.x | major-behind | 2025-04-30 | critical | Node 18 past EOL — move to 20 LTS or 22 |

## Action items

- **critical** — replace `request` (deprecated, unmaintained) with `undici` or native `fetch`.
- **critical** — upgrade Node off 18.x (past end-of-life) to an active LTS.
- **ok** — routine minor bumps available for `yaml`, `zod`.
