<!-- HARNESS:BEGIN (managed by harness-stack — edit above/below these markers) -->
## Harness operating rules

This project is managed by **Harness**. The following rules apply to the main
agent and every sub-agent.

### Fresh context is mandatory
For any time-sensitive decision — which library/API/version to use, whether an
MCP or skill exists today, current vulnerability/CVE data, current best
practice — **do not rely on training-cut knowledge**. Use web search and the
**Context7** MCP (installed as a base MCP) to ground the decision in current,
version-specific docs. Prefer Context7 over memory for any library question.

### Spec-driven by default
New work flows through **Spec Kit** (constitution → specify → plan → tasks →
implement) and uses **Superpowers** discipline (TDD, contracts, two-stage
review) where the platform supports it.

### Consent-gated skills
No skill runs silently. Every skill use is surfaced as
(skill | source | what | why-now) and confirmed (y / n / always-for-project).

### Sub-agents are the source of truth
Sub-agents live in `.subagents/*.yaml` (platform-agnostic). Platform-native
agent files are generated — edit the YAML, then run `harness build-agents`.
Model names live only in `.harness/model-map.yaml`; agents declare a tier.
<!-- HARNESS:END -->
