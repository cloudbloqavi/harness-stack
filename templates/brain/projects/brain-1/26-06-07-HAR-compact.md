# brain-1 (Ledger) — compact — 26-06-07

<!-- Single per-brain daily rollup. Detailed logs: <repo>/26-06-07-HAR.md -->

## ledger-api
- 7f3a9c1 — Added cursor-paginated `/v2/transactions`; deprecated `/v1`
  (90-day sunset). Fixes large-account timeouts.
- a9f0c12 — Added `Deprecation`/`Sunset` headers to `/v1/transactions`.

## ledger-web
- b21e0d4 — Migrated the transactions view to `/v2`; temporary `/v1` shim
  pending ledger-api's sunset. Downstream of ledger-api 7f3a9c1.
