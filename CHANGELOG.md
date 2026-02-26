# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [6.8.0] - 2026-02-22

### Added
- **`EvidenceSummaryIntegration` enhanced** — Wired into plugin init (`src/index.ts`) with `evidence_auto_summaries: true` default. Auto-generates evidence summaries for long-running tasks automatically.
- **`/swarm-evidence-summary` slash command** — New command (`src/commands/evidence.ts`, `src/services/evidence-service.ts`) to manually trigger evidence summary generation.
- **`phase_monitor.ts` hook** — `createPhaseMonitorHook()` detects phase transitions and automatically triggers preflight. Exported from `src/hooks/index.ts`.
- **`createPreflightIntegration()` wired** — Integrated into plugin hook chain in `src/index.ts` to enable phase-boundary preflight automation.
- **`PlanSyncWorker` background worker** — `PlanSyncWorker` class in `src/background/plan-sync-worker.ts` with `fs.watch` + 2s polling fallback, 300ms debounce, overlap lock, safe shutdown. Auto-regenerates plan.md from plan.json when out of sync.
- **`plan_sync` default changed to `true`** — `src/config/schema.ts` now defaults to `plan_sync: true` for automatic plan synchronization.
- **Rollback/disable safeguards** — Timeout isolation for background workers, callback safety for event handlers, graceful shutdown on plugin unload.

### Tests
- 808 new tests: evidence-summary automation, evidence-summary-init integration and adversarial, phase-preflight-auto, plan-sync-worker unit, adversarial, integration and init.
- Total: 4008 tests across 136 files, all passing.

## [6.7.0] - 2026-02-22

### Added
- **Background automation framework** — `src/background/` directory with event bus, circuit breaker, automation queue, worker registry, background manager, status artifact writer. Enables autonomous background operations without GUI interaction.
- **`AutomationConfig` Zod schema** — Configuration schema with `mode` (manual/hybrid/auto) and capability flags: `plan_sync`, `phase_preflight`, `config_doctor_on_startup`, `config_doctor_autofix`, `evidence_auto_summaries`, `decision_drift_detection`.
- **`EvidenceSummaryIntegration`** — Auto-generates evidence summaries when `evidence_auto_summaries: true`. Hooks into plugin init and slash command execution.
- **`PreflightTriggerManager`** — Detects phase transitions and auto-triggers preflight checks. Wires into phase-monitor hook in the execution pipeline.
- **`createPreflightIntegration()`** — Integration factory that sets up the preflight automation pipeline.
- **`ConfigDoctorService`** — Validates plugin configuration on startup, reports issues, and optionally autofixes safe problems.
- **`DecisionDriftAnalyzer`** — Analyzes architect decisions in plan.json and warns about contradictions or drift from previous decisions.
- **`/swarm-preflight`** — Manual preflight health check slash command.
- **`/swarm-diagnose`** — Plugin diagnostic slash command with configuration validation, evidence completeness check, and health status.
- **`/swarm-export`** — Export plan.md and context.md as portable JSON with version and timestamp.
- **`/swarm-history`** — View completed phases from plan.md with status icons and task counts.
- **`/swarm-sync-plan`** — Sync plan.json to plan.md when out of sync (manual or background).
- **Architecture shift to GUI-first, background-first** — Business logic in services; slash commands are thin adapters for control surfaces.
- **Conservative security defaults** — `phase_preflight: false`, `config_doctor_autofix: false` (explicit opt-in required for action-triggering automation).

### Tests
- 73 new tests: evidence-summary integration, phase-preflight automation, background workers, preflight integration, config doctor, decision drift analyzer, slash commands.
- Total: 2200 tests across 90 files, all passing.

## [6.6.1] - 2026-02-22

### Changed
- **Native Windows install documentation** — Added comprehensive installation guide for Windows PowerShell, covering path handling, path traversal fixes, and verification steps specific to the Windows filesystem.
- **Linux/Docker install runbook** — Expanded installation guide for Linux environments with Docker Desktop setup, including volume mounting, container configuration, and troubleshooting for shared folders.
- **LLM-hosted install runbook** — Created agent-executable installation guide for LLM operators, including step-by-step procedures, verification checkpoints, and hand-off templates for structured validation reports.

### Tests
- No new tests added.
- Total: 2127 tests across 86 files, all passing.

## [6.5.0] - 2026-02-22

### Added
- **`todo_extract` tool** — Scan the codebase for TODO/FIXME/HACK/XXX/WARN/NOTE comments. Returns structured data with file paths, line numbers, comment types, and confidence scores. Security: path traversal prevention, Bun.spawn array args, Promise.race timeouts, Zod validation.
- **`evidence_check` tool** — Verify completed tasks in the plan have required evidence types. Compares plan.md task completion against `.swarm/evidence/` directory to identify gaps. Security: path traversal prevention, Zod validation.
- **`pkg_audit` tool** — Run package manager security audit (npm, pip, cargo) and return structured CVE data. Returns package vulnerabilities, severity ratings, and remediation suggestions. Security: bounded output, error handling without throwing.
- **`complexity_hotspots` tool** — Identify high-risk code hotspots by combining git churn frequency with cyclomatic complexity estimates. Returns files with churn count, complexity score, risk score, and recommended review level. Security: git security (proper refs), path traversal prevention.
- **`schema_drift` tool** — Compare OpenAPI spec against actual route implementations to find drift. Detects undocumented routes in code and phantom routes in spec. Security: path traversal prevention, spec validation.

### Tests
- 69 new tests: todo_extract (27), evidence_check (12), pkg_audit (18), complexity_hotspots (10), schema_drift (2).
- Total: 2127 tests across 86 files, all passing.

## [6.4.0] - 2026-02-22

### Added
- **`checkpoint` tool** — Git-backed save points for multi-file refactor safety. Exports: `checkpoint(label: string): Promise<void>`, `restore(id: string): Promise<void>`, `list(): Promise<CheckpointInfo[]>`, `delete(id: string): Promise<void>`. Before any multi-file refactor (≥3 files), architect automatically creates a checkpoint commit. On critical integration failure, restores via soft reset instead of iterating into a hole.
- **`symbols` tool** — Export inventory for a module: functions, classes, interfaces, types, enums. Exports: `extractSymbols(filePath: string, exportedOnly?: boolean): ExportedSymbol[]`. Uses AST parsing with TypeScript compiler API. Gives the Architect instant visibility into a file's public API surface without reading the full source.
- **`CheckpointConfigSchema`** — Optional `checkpoint: { enabled: boolean, max_age_days: number, auto_create_threshold: number }` in plugin config. Defaults to `{ enabled: true, max_age_days: 30, auto_create_threshold: 3 }`.
- **Architect context window expanded** — Context budget limit increased from 800 to 1,200 tokens to support larger refactor planning and multi-module architectural reasoning.

### Tests
- 27 new tests: checkpoint tool (34 tests, including adversarial and rollback scenarios).
- Total: 2058 tests across 81 files, all passing.

## [6.3.0] - 2026-02-19

### Added
- **`imports` tool** — Agent-accessible tool to list imported modules in JavaScript/TypeScript files via AST parsing. Exports: `listImports(filePath: string): ImportInfo[]`. Security: validates path via `validateSwarmPath`, rejects non-code extensions, no arbitrary code execution.
- **`lint` tool** — Agent-accessible tool to run biome or eslint on the codebase. Exports: `runLint(mode: 'check' | 'fix', linter?: 'biome' | 'eslint'): LintResult`. Security: bounded output (512KB), command length limit (500 chars), error handling without throwing.
- **`secretscan` tool** — Agent-accessible tool to scan for secrets/credentials in the codebase. Exports: `runSecretScan(paths?: string[]): SecretScanResult`. Security: bounded output (1MB), pattern-based detection (no API calls), error handling without throwing.
- **Architect pre-reviewer workflow reordering** — Architect Phase 5 now runs security tools (lint + secretscan) BEFORE reviewer agent. Updated workflow: coder → diff → security (lint + secretscan) → review → verify → adversarial.
- **`LintConfigSchema`** — Optional `lint: { enabled: boolean, mode: 'check' | 'fix', linter: 'biome' | 'eslint' }` in plugin config. Defaults to `{ enabled: true, mode: 'check', linter: 'biome' }`.
- **`SecretScanConfigSchema`** — Optional `secretscan: { enabled: boolean }` in plugin config. Defaults to `{ enabled: true }`.
- **System-enhancer lint/secretscan disabled hints** — When `lint.enabled: false`, injects `[SWARM HINT] Linter disabled` into architect session. When `secretscan.enabled: false`, injects `[SWARM HINT] Secret scanning disabled`. Injected in both Path A and Path B.

### Tests
- 42 new tests: imports tool (6), lint tool (37), secretscan tool (7), system-enhancer disabled hints (4).
- Total: 2031 tests across 78 files, all passing.

### Rollback Note
If critical validation fails after publishing v6.3.0, restore the following files from the pre-bump commit (the commit before version bump):

```bash
# Find the pre-bump commit
git log --oneline -2

# Restore package.json
git checkout <pre-bump-commit> -- package.json

# Restore CHANGELOG.md
git checkout <pre-bump-commit> -- CHANGELOG.md

# Restore v6.3 tool/prompt files (example for tools/)
git checkout <pre-bump-commit> -- src/tools/
```

This preserves all git history and is non-destructive. After restoring, amend the version bump or create a new release after fixing the validation issue.

## [6.2.0] - 2026-02-19

### Added
- **Retrospective evidence type** — New `RetrospectiveEvidenceSchema` added to `src/config/evidence-schema.ts`. Fields: `phase_number`, `total_tool_calls`, `coder_revisions`, `reviewer_rejections`, `test_failures`, `security_findings`, `integration_issues`, `task_count`, `task_complexity` (enum: `low | medium | high | mixed`), `top_rejection_reasons` (string array), `lessons_learned` (string array, max 5). Discriminated union `EvidenceSchema` now includes `retrospective` type. Fully additive — existing evidence files unaffected.
- **Retrospective injection in system enhancer** — After each phase completes, the most recent `retrospective` evidence bundle is loaded and injected as a `[SWARM RETROSPECTIVE]` hint into architect sessions (architect-only, capped at 800 chars). Skipped when all rejection counts are zero and `lessons_learned` is empty. Injected in both legacy path A and scoring path B in `src/hooks/system-enhancer.ts`.
- **Soft compaction advisory** — System enhancer monitors architect session tool-call counts and injects a `[SWARM HINT]` advisory at configurable thresholds (default: 50, 75, 100, 125, 150). A `lastCompactionHint` guard on `AgentSessionState` prevents repeated injection at the same threshold. Non-blocking — architect may ignore.
- **`CompactionAdvisoryConfigSchema`** — Optional `compaction_advisory` config block in `PluginConfigSchema`: `{ enabled: boolean (default: true), thresholds: number[] (default: [50,75,100,125,150]), message: string (default: standard advisory text) }`. All fields optional with defaults.
- **`lastCompactionHint: number` on `AgentSessionState`** — Initialized to `0` in `ensureAgentSession`. Tracks the last threshold at which a compaction advisory was injected; prevents duplicate advisories.
- **Architect Rule 10 — RETROSPECTIVE TRACKING** — After each phase completes, architect writes a `retrospective` evidence bundle to `.swarm/evidence/<phase-id>/` capturing phase metrics (coder revisions, reviewer rejections, test failures, etc.) and `lessons_learned`. Injected into `src/agents/architect.ts`.
- **Architect Phase 5 step 5d COVERAGE check** — After verification tests pass, if coverage < 70% architect requests an additional test pass. Soft guideline, not a hard gate.
- **Architect Phase 6 retrospective write step** — Phase 6 now includes a step to write retrospective evidence before summarizing to the user.
- **Test engineer COVERAGE REPORTING section** — `src/agents/test-engineer.ts` prompt now includes a `COVERAGE REPORTING` section after `OUTPUT FORMAT`, instructing the test engineer to report line/branch/function coverage percentages and flag files below 70%.

### Tests
- 14 new tests: `RetrospectiveEvidenceSchema` validation (4), system-enhancer retrospective injection (4), system-enhancer compaction advisory (6).
- Total: 1391 tests across 60 files, all passing.

## [6.1.2] - 2026-02-18

### Fixed
- **Fail-safe disable guardrails on config validation failure** — `loadPluginConfig()` previously returned `PluginConfigSchema.parse({})` on merged-config validation failure, which silently re-enabled guardrails via Zod defaults (`enabled: true`, `max_duration_minutes: 30`). Now returns `PluginConfigSchema.parse({ guardrails: { enabled: false } })`, matching the warning message that claims guardrails are disabled.
- **Prevent `unknown` agent session seeding in guardrails hook** — `createGuardrailsHooks` called `ensureAgentSession(sessionID, agentName)` where `agentName` could be `undefined` (when `activeAgent` had not yet been set for the session). This seeded the session identity as `"unknown"`, which has no built-in profile and fell back to base guardrails (30-minute limit). Subsequent architect-exemption checks never matched. Fixed by falling back to `ORCHESTRATOR_NAME` via `?? ORCHESTRATOR_NAME` so the session is always seeded with a valid identity.
- **Honor explicit `guardrails.enabled: false` in fallback logic** — `src/index.ts` guardrails fallback only disabled guardrails when `loadedFromFile === false`. If a config file existed but validation failed, `loadedFromFile` remained `true` and guardrails re-enabled via defaults. Now checks `config.guardrails?.enabled === false` first (highest priority), ensuring a deliberate disable survives even when other config parts are invalid.

## [6.1.1] - 2026-02-18

### Security
- **Removed `_loadedFromFile` from `PluginConfigSchema`** — This internal loader flag was reachable via JSON deserialization. A config file containing `"_loadedFromFile": true` could bypass the guardrails fail-safe that disables guardrails when no config file is present. The field is now internal-only via `loadPluginConfigWithMeta()`.
- **TOCTOU hardening** — Added second `content.length` check after `readFileSync` in `loadRawConfigFromPath` to guard against files that grow between `statSync` and `readFileSync`.

### Changed
- **`loadPluginConfigWithMeta()`** — New internal function (not in public API) used only by `src/index.ts`. Returns `{ config: PluginConfig, loadedFromFile: boolean }` to keep loader metadata separate from user config.
- **`deepMerge` extracted to `src/utils/merge.ts`** — Breaks circular ESM dependency: `constants.ts → loader.ts → schema.ts → constants.ts`. Both `deepMerge` and `MAX_MERGE_DEPTH` remain re-exported from `loader.ts` for backward compatibility.
- **Dead function `loadConfigFromPath` deleted** — Was never called; removed to reduce confusion about authoritative config load path.

### Fixed
- **`retrieve_summary` tool registered** — `src/tools/retrieve-summary.ts` was implemented but not wired into the plugin tool block. Agents can now call `retrieve_summary` to retrieve full tool outputs that were auto-summarized.

### Tests
- 3 new tests: security test verifying `_loadedFromFile` in JSON is stripped by Zod (`loader.test.ts`), end-to-end guardrails-disabled path (`guardrails-disabled.test.ts`), `_loadedFromFile` bypass attempt is blocked (`guardrails-disabled.test.ts`).
- 5 stale tests removed: `_loadedFromFile` tracking tests in `loader.test.ts` and `schema.test.ts` (field no longer in schema).

## [6.1.0] - 2026-02-18

### Added
- **`docs` agent** — Documentation synthesizer, enabled by default. Delegates in Phase 6 step 2 with a list of changed files and change summary. Configurable via `docs: { enabled, doc_patterns }` in plugin config.
- **`designer` agent** — UI/UX specification agent, opt-in via `ui_review: { enabled: true }`. Generates component scaffolds before coder runs on UI tasks (Rule 9: UI/UX Design Gate in architect prompt).
- **`DocsConfigSchema`** — Optional `docs` config block: `{ enabled: boolean, doc_patterns: string[] }`.
- **`UIReviewConfigSchema`** — Optional `ui_review` config block: `{ enabled: boolean }`.
- **Guardrails profiles** for `docs` (200 tool calls / 30 min) and `designer` (150 tool calls / 20 min) in `DEFAULT_AGENT_PROFILES`.
- **Architect Rule 9** — UI/UX Design Gate: when task matches UI trigger conditions (UI keywords or UI file paths), delegate to designer first, then pass scaffold to coder.
- **Phase 5 updated to steps 5a–5h** — Step 5a is the conditional UI design gate; step 5b onwards is the existing coder → diff → review → security → verify → adversarial sequence.
- **Phase 6 step 2** — After rescan, architect delegates docs agent with changed files and change summary.
- **System-enhancer hint injection** — When `ui_review.enabled: true`, injects `[SWARM CONFIG] UI/UX Designer agent is ENABLED` hint. When `docs.enabled: false`, injects docs-disabled hint. Both injected in Path A and Path B.
- New delegation examples in architect prompt for `mega_docs` and `mega_designer`.

### Tests
- 55 new tests: createDocsAgent (structure, model, temperature, prompt overrides), createDesignerAgent (structure, model, temperature, prompt overrides), agent registration constants (docs + designer in PIPELINE_AGENTS/ALL_AGENT_NAMES), system-enhancer hint injections (4 cases), designer opt-in registration (2 cases).
- Total: 1258 tests across 57 files.

## [6.0.1] - 2026-02-18

### Fixed
- **Fail-safe guardrails on config load failure** — When config file exists but fails to parse, guardrails now default to `enabled: false` instead of silently re-enabling with defaults. Adds `_loadedFromFile` flag and loud warning on non-ENOENT load errors.
- **Cross-session warning leak** — `messagesTransform` no longer scans all sessions for budget warnings. Only the current session's invocation window is checked, preventing Session A's limit warnings from being injected into Session B.
- **Shallow config merge for object-typed keys** — All object-typed config keys (`guardrails`, `context_budget`, `evidence`, `summaries`, `hooks`, `review_passes`, `integration_analysis`) now use deep merge. Project-level partial overrides no longer clobber unrelated fields from user config.
- **Invocation window creation when guardrails disabled** — Delegation tracker now skips `beginInvocation()` when `guardrails.enabled` is `false`, avoiding unnecessary state accumulation.

### Tests
- 15 new tests: config load failure fallback (5), cross-session isolation (4), deep merge (3), invocation window skip (3).
- Total: 1203 tests across 53 files.

## [6.0.0] - 2026-02-17

### Added
- **Dual-pass security reviewer** — After general reviewer APPROVED, architect deterministically triggers a security-only reviewer pass when file path matches security globs (auth, api, crypto, security, middleware, session, token) or coder output contains security keywords. Configurable via `review_passes` config.
- **Adversarial testing pass** — After verification tests PASS, architect delegates test_engineer with adversarial-only framing (attack vectors, boundary violations, injection attempts). Pure prompt engineering, no new infrastructure.
- **Integration impact analysis** — After coder completes, architect runs `diff` tool. If contract changes detected (exports, interfaces, types), explorer runs impact analysis before review.
- **`diff` tool** — New agent-accessible tool providing structured git diff with numstat parsing, contract change detection, base ref support (HEAD/staged/unstaged), path filtering, and 500-line truncation.
- **`SECURITY_CATEGORIES` constant** — OWASP Top 10 2021 categories exported from `src/agents/reviewer.ts` for security-focused review passes.
- **`review_passes` config schema** — `always_security_review` (default: false) and `security_globs` (default: 7 patterns) for controlling dual-pass behavior.
- **`integration_analysis` config schema** — `enabled` (default: true) for controlling integration impact analysis.
- System-enhancer hint injection for `always_security_review` and `integration_analysis.enabled` config overrides.
- 87 new unit tests (diff tool, SECURITY_CATEGORIES, config schemas, architect prompt, system-enhancer hints).

### Changed
- **BREAKING**: Architect prompt Rules 7-8 consolidated into single Rule 7 with full QA sequence (coder → diff → review → security review → verification tests → adversarial tests). Users with `customPrompt` overrides must update manually.
- Phase 5 (Execute) rewritten to 7 compact steps (5a-5g) including integration analysis, security gate, and adversarial testing.
- AGENTS section now lists "Available Tools: diff".
- Three new delegation examples added (security-only reviewer, adversarial test_engineer, integration impact explorer).

### Tests
- Total: ~1188 tests across 53+ files.

## [5.2.0] - 2026-02-17

### Changed
- **BREAKING**: Guardrails now enforce per-invocation budgets instead of session-wide. Each agent delegation gets fresh duration/tool-call/error limits. Same-agent re-invocations (e.g., coder → architect → coder) no longer accumulate counters.
- Architect remains unlimited (no invocation windows created).
- `AgentSessionState` refactored: budget counters moved to `InvocationWindow` struct.

### Added
- **Architect protocol enforcement** — New RULES 6-8 mandate critic review before implementation and QA gate (reviewer + test_engineer) after every coder task.
- Delegation gate hook now detects and warns about protocol violations (coder → coder without QA agents).
- `beginInvocation()`, `getActiveWindow()`, `pruneOldWindows()` in `src/state.ts`.
- `InvocationWindow` interface for per-invocation budget tracking.
- Invocation ID tracking: `lastInvocationIdByAgent` per session.
- Window pruning: max 50 windows per session, 24h max age.
- Invocation metadata in circuit breaker logs (`invocationId`, `windowKey`).

### Fixed
- Circuit breaker no longer trips on second invocation of same agent after 30-minute cumulative session time.
- Architect no longer drifts into coder loop, skipping reviewer/test_engineer gates.

### Tests
- 8 new invocation window unit tests in `tests/unit/state-invocation-windows.test.ts`.
- 2 new multi-invocation integration tests in `tests/integration/circuit-breaker-multi-invocation.test.ts`.
- 3 new protocol violation tests in `tests/unit/hooks/delegation-gate.test.ts`.
- Updated all existing guardrails and integration tests for window model.
- Total: 1101 tests across 48 files.

## [5.1.8] - 2026-02-16

### Fixed
- Fixed a potential race condition in the delegation tracker where spurious architect messages could reset active subagent sessions or fail to properly initialize the architect session state.
- Improved circuit breaker stability by ensuring session duration is tracked correctly across delegation boundaries.

## [5.1.7] - 2026-02-16
### Fixed
- **Architect identity normalization hardening** — `stripKnownSwarmPrefix` now handles case-insensitive and separator variants (underscore/hyphen/space) when stripping agent prefixes. Paid architect naming variants (e.g., `paid_architect`, `paid-architect`, `PAID ARCHITECT`) now correctly resolve to the orchestrator identity for exemption purposes. Subagent and unknown agent guardrails behavior remains unchanged.

## [5.1.6] - 2026-02-15
### Fixed
- **Architect identity-stuck hotfix** — Split tool-activity and agent-identity timestamps to prevent stale subagent identity from persisting during frequent tool calls. The `lastAgentEventTime` is now updated via `ensureAgentSession` (which handles agent name changes) rather than redundant manual updates, ensuring accurate stale detection and proper architect exemption during delegation handoffs.

### Code Quality
- Removed redundant timestamp update in delegation-tracker hook where `ensureAgentSession` already handles `lastAgentEventTime` updates on agent name changes

## [5.1.5] - 2026-02-14
### Fixed
- **Architect circuit breaker race condition** — Reduced stale delegation window from 60 seconds to 10 seconds to prevent architect from being misidentified as a subagent during rapid delegation transitions. Fixes issue where architect would inherit subagent duration limits when making tool calls immediately after subagent finishes, before `chat.message` hook updates state.

### Tests
- Added 6 comprehensive integration tests in `tests/integration/circuit-breaker-race-condition.test.ts` covering:
  - Architect exemption after `delegationActive=false`
  - Stale delegation timeout (>10s idle)
  - Subagent legitimately hitting limits within 10s window
  - Rapid architect→subagent→architect transitions
  - Prefixed agent name limit resolution (e.g., `mega_coder`)
  - Unknown agent name fallback to architect profile
- Total: 1034 tests passing across 45 files

## [5.1.4] - 2026-02-14
### Fixed
- **Architect circuit breaker regression** — Ensured delegation end resets active agent to architect and added fallback exemption check so architects never inherit subagent duration limits.
- **Docs accuracy refresh** — Updated badges, command lists, guardrail notes, and test counts for current v5.1.x state.

### Tests
- Added regression test for architect duration exemption after delegation ends

## [5.1.3] - 2026-02-14
### Fixed
- **Guardrails circuit breaker architect exemption regression** — Fixed stale delegation timeout and added second exemption check to prevent false circuit breaker trips for the architect agent during complex orchestration flows.

### Added
- **Reversible summaries for oversized tool outputs** — New `tool.execute.after` hook auto-summarizes tool outputs that exceed a configurable byte threshold (default 20 KB). Oversized outputs are replaced with a compact summary containing a retrieval ID (e.g., S1, S2) while the full content is stored in `.swarm/summaries/`. Configurable via `summaries` config block:
  - `enabled` (default true), `threshold_bytes` (default 20480), `max_summary_chars` (default 1000)
  - `max_stored_bytes` (default 10 MB), `retention_days` (default 7)
- **`/swarm-retrieve <id>` command** — Retrieves the full original output for a given summary ID
- Hysteresis-based threshold (1.25× factor) prevents churn for outputs near the threshold boundary
- Graceful fail-open: if storage fails, original output passes through unchanged
- Content-type detection (JSON, code, text, binary) for intelligent summary previews

### Tests
- 8 new tool-summarizer hook tests in `tests/unit/hooks/tool-summarizer.test.ts` (disabled config, threshold filtering, summary storage, ID incrementing, counter reset, fail-open, factory, end-to-end integration)
- 4 new retrieve command tests in `tests/unit/commands/retrieve.test.ts` (help text, valid retrieval, not found, invalid ID)
- Total: 1027 tests across 44 files

## [5.1.2] - 2026-02-13
### Added
- **`/swarm-benchmark` command** — New performance metrics command with three modes:
  - Default: In-memory snapshot from `swarmState` (tool call counts, success rates, avg durations, delegation chains, active sessions)
  - `--cumulative`: Aggregates evidence bundles from `.swarm/evidence/` (review verdicts, test pass rates, diff stats)
  - `--ci-gate`: Exits with pass/fail verdict against configurable thresholds (tool success rate ≥95%, test pass rate ≥90%, review approval rate ≥80%)
- Outputs markdown summary with optional raw JSON block for machine consumption

### Tests
- 8 new benchmark command tests in `tests/unit/commands/benchmark.test.ts`
- Total: 1009 tests passing

## [5.1.1] - 2026-02-13
### Fixed
- **Structural architect guardrail exemption** — Added early-return in `guardrails.ts` `toolBefore` that checks `stripKnownSwarmPrefix(activeAgent) === ORCHESTRATOR_NAME` and bypasses all guardrail checks for the architect. Prevents false circuit breaker trips from complex delegation state resolution edge cases.

### Added
- **Delegation gate hook** — New `src/hooks/delegation-gate.ts` warns the architect when coder delegations are too complex. Detects oversized delegations (>4000 chars), multiple FILE:/TASK: directives, and batching language. Non-blocking (prepends warning, doesn't throw).
- **Delegation gate config** — `hooks.delegation_gate` (boolean, default true) and `hooks.delegation_max_chars` (number, default 4000) added to `HooksConfigSchema`

### Tests
- 5 new architect exemption tests in `tests/unit/hooks/guardrails.test.ts`
- 10 new delegation gate tests in `tests/unit/hooks/delegation-gate.test.ts`
- Total: 1001 tests passing

## [5.1.0] - 2026-02-12
### Added
- **Score-based context injection (opt-in)** — Context candidates (phase, task, decisions, agent context) are now ranked by importance score before injection under token budget. Scoring is disabled by default for safe rollout.
- **Scoring configuration** — New `context_budget.scoring` block with:
  - `enabled: false` (default) — opt-in scoring
  - `max_candidates: 100` — limit candidate pool before ranking
  - `weights` — 8 configurable weights for feature scoring (phase, current_task, blocked_task, recent_failure, recent_success, evidence_presence, decision_recency, dependency_proximity)
  - `decision_decay` — exponential or linear decay for stale decisions
  - `token_ratios` — per-content-type token estimation (code denser than prose)
- **Dependency proximity scoring** — Context from task dependencies scores higher with formula `weight / (1 + depth)`
- **Decision decay** — Stale decisions decay in importance: exponential `2^(-age/half_life)` or linear mode

### Changed
- `src/hooks/system-enhancer.ts` — When `context_budget.scoring.enabled: true`, ranks candidates before injection; disabled mode unchanged (backward compatible)
- `src/config/schema.ts` — Added `ScoringConfigSchema`, `ScoringWeightsSchema`, `DecisionDecaySchema`, `TokenRatiosSchema`
- `src/config/constants.ts` — Added `DEFAULT_SCORING_CONFIG` and `resolveScoringConfig()` for deep-merge with user config

### Tests
- 15 new tests in `tests/unit/hooks/context-scoring.test.ts` covering:
  - Disabled mode preserves order
  - Deterministic ranking
  - Dependency depth decay formula
  - Exponential and linear decision decay
  - Tie-breaking (score → priority → id)
  - Edge cases (empty, all-zero scores, max_candidates truncation)
- Total: 990 tests passing

## [5.0.10] - 2026-02-12
### Fixed
- **Architect session stuck with 30-minute limit** — The primary architect session's agent name was never set in `swarmState.activeAgent` because `delegation-tracker.ts` bails immediately when `input.agent` is empty (which is the case for primary sessions). When the first tool call arrived, `ensureAgentSession()` created a session with `agentName: 'unknown'`, and `resolveGuardrailsConfig()` returned the base config (30-minute limit) since 'unknown' had no built-in profile. Two-layer fix:
  1. **Primary session defaults to architect** — In `tool.execute.before` hook, if no active agent is mapped for the session, it's the primary agent, so we set `activeAgent` to `ORCHESTRATOR_NAME` ('architect'). Subagent delegations always set activeAgent via chat.message before tool calls.
  2. **Belt-and-suspenders: 'unknown' → architect** — In `resolveGuardrailsConfig()`, the agent name 'unknown' is now treated as 'architect'. This makes resolution resilient even if the race recurs through a different code path.

### Changed
- `resolveGuardrailsConfig()` now maps 'unknown' to architect profile, ensuring unlimited limits for any session that falls through the cracks.

### Tests
- Updated guardrails tests to use 'custom_agent' instead of 'unknown' for tests that need base config limits, since 'unknown' now maps to architect (unlimited).
- 975 tests passing (2 unrelated dist-integrity path format failures remain).

## [5.0.9] - 2026-02-11
### Fixed
- **Stale 30-minute guardrail when agent switches** — Session state (counters, tracking data) now resets when `agentName` changes in `ensureAgentSession()`, preventing previous agent's limits from affecting the new agent.
- **Architect tool-call limit unlimited** — `max_tool_calls: 0` now means "no limit". Schema and profile updated to accept 0. Architect's built-in profile defaults to 0 (unlimited), matching the duration behavior from v5.0.8.
- **Tool-call checks skipped when unlimited** — Hard-limit and warning logic now bypasses tool-call validation when `max_tool_calls` is 0, avoiding false positive warnings/blocks.

## [5.0.8] - 2026-02-11
### Fixed
- **Circuit breaker killing architect sessions prematurely** — The fundamental architectural flaw was that the duration check used a hard cap of 120 minutes in the schema with no way to disable it. The architect's 90-minute default was too low for multi-phase projects. Three changes fix this:
  1. **Unlimited duration for architects** — `max_duration_minutes: 0` now means "no time limit". The architect's built-in profile defaults to 0 (unlimited).
  2. **Idle timeout replaces hard duration cap** — New `idle_timeout_minutes` field (default: 60 min) detects truly stuck agents by tracking time since last SUCCESSFUL tool call, rather than penalizing productive long-running sessions.
  3. **Schema range expanded** — `max_duration_minutes` max raised from 120 to 480 minutes for users who want finite but long sessions.

### Added
- `idle_timeout_minutes` field in `GuardrailsProfileSchema` and `GuardrailsConfigSchema` — configurable per-agent idle detection (min: 5, max: 240, default: 60).
- `lastSuccessTime` field in `AgentSessionState` — tracks timestamp of most recent successful tool call for idle timeout calculation.
- Idle timeout hard limit check in circuit breaker — throws when no successful tool call for `idle_timeout_minutes` minutes.
- Division-by-zero guard for duration soft warning when `max_duration_minutes` is 0.

### Changed
- `DEFAULT_AGENT_PROFILES.architect.max_duration_minutes` changed from 90 to 0 (unlimited).
- `GuardrailsProfileSchema.max_duration_minutes` range changed from `min(1).max(120)` to `min(0).max(480)`.
- `GuardrailsConfigSchema.max_duration_minutes` range changed from `min(1).max(120)` to `min(0).max(480)`.

### Tests
- Updated schema tests for new `max_duration_minutes` range (0 valid, 480 max) and architect default (0).
- Added `idle_timeout_minutes` schema validation tests (5 tests).
- Added unlimited duration circuit breaker tests (3 tests).
- Added idle timeout circuit breaker tests (3 tests).
- Added `lastSuccessTime` tracking tests (3 tests).
- Updated `GuardrailsConfigSchema` tests to include `idle_timeout_minutes: 60` default.
- Total: 927 tests passing (was 909).

## [5.0.7] - 2026-02-11
### Fixed
- **Removed stale orphan declaration files from dist/** — Deleted 17 stale `.d.ts` files from prior build configurations that no longer have matching source files: `dist/agents/auditor.d.ts`, `dist/agents/security-reviewer.d.ts`, `dist/agents/sme-unified.d.ts`, and the entire `dist/agents/sme/` directory (14 individual SME domain agent declarations). These were harmless type declarations (not runtime code), but cluttered the published package.

### Changed
- **Build script now cleans dist/ before rebuilding** — Added `rm -rf dist` as the first step in the `build` script and as a standalone `clean` script. This prevents orphan files from accumulating across build configuration changes. The `prepublishOnly` hook runs `build`, so npm publishes will always start from a clean dist/.

## [5.0.6] - 2026-02-11
### Fixed
- **Circuit breaker running stale code from orphan dist files** — Stale `dist/guardrails.js` and `dist/state.js` from v4.6.0 were shipping in the npm package alongside the correct bundled `dist/index.js`. Bun's module resolver could load these orphan files, which contained the old 30-minute duration limit, old 60-minute stale session eviction, and old aggressive "CIRCUIT BREAKER: Stop making tool calls" messages — completely bypassing the v5.0.3–5.0.5 fixes. Removed both orphan files from dist/.

## [5.0.5] - 2026-02-11
### Fixed
- **Circuit breaker triggers too early on tool calls** — Default `warning_threshold` was 0.5 (warnings at 50% of limit), causing agents to receive "wrap up" messages at just 100 tool calls for subagents with a 200-call limit. Raised default to 0.75. Added built-in per-agent-type profiles so each agent gets appropriate limits: coder/test_engineer (400 calls, 45 min, 0.85 threshold), explorer (150 calls, 20 min), reviewer/critic/sme (200 calls, 30 min, 0.65 threshold), architect (800 calls, 90 min, 0.75 threshold).
- **Warning messages too aggressive** — Softened circuit breaker messages from "🛑 CIRCUIT BREAKER: Stop making tool calls" to "🛑 LIMIT REACHED: Finish the current operation". Warning messages now include concrete usage numbers (e.g., "tool calls 340/400, duration 35/45 min") instead of vague "wrap up your current task" language. Added defensive handling for empty warning reasons.

### Changed
- `DEFAULT_ARCHITECT_PROFILE` is now deprecated in favor of `DEFAULT_AGENT_PROFILES` which contains profiles for all 7 agent types.
- `resolveGuardrailsConfig()` now applies built-in profiles for all known agent types, not just the architect.
- `AgentSessionState` now includes a `warningReason` field for tracking what triggered the warning.

### Tests
- Updated guardrails test assertions to match new message format and per-agent profile behavior.
- **908 total tests** across 39 files.

## [5.0.4] - 2026-02-11
### Fixed
- **Guardrails race condition: sessions created with wrong agent name** — The `tool.execute.before` hook could fire before `chat.message` (which provides the agent name), causing guardrail sessions to be permanently stuck with `agentName: 'unknown'` and the default 30-minute limit instead of the architect's 90-minute limit. Added `ensureAgentSession()` which is called from both `chat.message` and `tool.execute.before` hooks, ensuring the session always has the correct agent name regardless of hook firing order.
- **Stale session eviction killed architect sessions prematurely** — The eviction threshold was 60 minutes (hardcoded `staleDurationMs = 3600000`), but the architect's max duration is 90 minutes. Any new session created after 60 minutes would evict the architect's session. Changed eviction to use `lastToolCallTime` instead of `startTime` and increased threshold to 120 minutes (matching the schema maximum).
- **Added diagnostic logging** — Circuit breaker now logs `agentName`, `resolvedMaxMinutes`/`resolvedMaxCalls`, and elapsed values via `warn()` when limits are hit, enabling production debugging.

### Tests
- **7 new tests** for `ensureAgentSession` (session creation, name updates from unknown, preservation of existing names, startTime reset).
- **909 total tests** across 39 files (up from 902 in v5.0.3).

## [5.0.3] - 2026-02-10
### Fixed
- **Guardrails circuit breaker now recognizes prefixed architect agents** — `resolveGuardrailsConfig()` previously compared the raw prefixed agent name (e.g., `local_architect`, `paid_architect`) against `ORCHESTRATOR_NAME` (`'architect'`) using exact match, which always failed. Added `stripKnownSwarmPrefix()` which uses suffix matching against `ALL_AGENT_NAMES` to strip **any** swarm prefix (not just hardcoded ones). Works for custom swarm names like `enterprise_architect`, `team_alpha_coder`, etc. Also fixed session creation in `guardrails.ts` to read the real agent name from `swarmState.activeAgent` instead of defaulting to `'unknown'`.

### Tests
- **19 new tests** for `stripKnownSwarmPrefix` (9 tests) and prefixed agent name resolution (10 tests, including custom swarm names).
- **902 total tests** across 39 files (up from 883 in v5.0.1).

## [5.0.2] - 2026-02-10
### Fixed
- **Removed `@agent_name` prefixes from delegation prompts** — The architect's system prompt template included `@{{AGENT_PREFIX}}` routing metadata in delegation format examples, which caused subagents to waste tool calls attempting self-delegation via the Task tool. Routing is now handled solely by the `subagent_type` parameter. Updated `src/agents/architect.ts` (27 occurrences), `docs/installation.md`, and `.swarm/context.md`.

## [5.0.1] - 2026-02-10
### Changed
- **Default architect guardrails** — The architect agent now automatically receives higher circuit breaker limits (600 tool calls, 90 min duration, 8 consecutive errors, 0.7 warning threshold) via `DEFAULT_ARCHITECT_PROFILE`. Proportional 3× scaling matches the architect's orchestration role. User-defined `profiles.architect` entries still take full precedence.

### Tests
- **7 new tests** for architect default profile resolution (automatic application, user override precedence, non-architect isolation, schema bounds validation).
- **883 total tests** across 39 files (up from 876 in v5.0.0).

## [5.0.0] - 2026-02-09
### Added
- **Canonical plan schema** — Machine-readable `plan.json` with Zod-validated `PlanSchema`, `TaskSchema`, and `PhaseSchema`. Structured task status (`pending`, `in_progress`, `completed`, `blocked`), phase-level status tracking, and schema versioning (`schema_version: "1.0"`).
- **Plan migration** — Automatic migration from legacy `plan.md` markdown format to structured `plan.json`. Preserves task status, dependencies, and phase structure. Idempotent and backward-compatible.
- **Evidence bundles** — Per-task execution evidence persisted to `.swarm/evidence/{taskId}/`. Five discriminated evidence types via Zod: `review` (with risk/issues), `test` (pass/fail counts), `diff` (files/additions/deletions), `approval`, and `note`. Atomic writes via temp+rename pattern.
- **Evidence retention** — Configurable retention policy: `max_age_days` (default: 90), `max_bundles` (default: 1000), `auto_archive` flag. `archiveEvidence()` function with maxBundles enforcement.
- **Evidence config** — `EvidenceConfigSchema` added to `PluginConfigSchema` with `enabled`, `max_age_days`, `max_bundles`, `auto_archive` fields.
- **`/swarm-evidence [task]`** — View evidence bundles for a specific task or list all tasks with evidence.
- **`/swarm-archive [--dry-run]`** — Archive old evidence bundles with dry-run support for previewing changes.
- **Per-agent guardrail profiles** — `GuardrailsProfileSchema` with optional override fields. `profiles` field in `GuardrailsConfigSchema` maps agent names to partial guardrail overrides. `resolveGuardrailsConfig()` pure merge function.
- **Context injection budget** — `max_injection_tokens` field in `ContextBudgetConfigSchema` (range: 100–50,000, default: 4,000). Budget-aware `tryInject()` in system-enhancer with priority-ordered injection: phase → task → decisions → agent context. Lower-priority items dropped when budget exhausted.
- **Enhanced `/swarm-agents`** — Agent count summary line, `⚡ custom limits` indicator for agents with guardrail profiles, and Guardrail Profiles summary section.
- **Packaging smoke tests** — 8 CI-safe tests validating `dist/` output: entry point existence, export verification, declaration files, and bundle integrity.
- **Evidence completeness check** in `/swarm-diagnose` — Reports tasks missing evidence.

### Changed
- System enhancer (`src/hooks/system-enhancer.ts`) refactored to use budget-aware `tryInject()` helper instead of direct `output.system.push()`.
- Plan-related slash commands (`plan`, `history`, `diagnose`, `export`) updated to use structured plan manager.
- Guardrails `toolBefore` hook now resolves per-agent config via `resolveGuardrailsConfig(config, session.agentName)`.
- `/swarm-agents` command now loads plugin config and passes guardrails data for profile display.
- Extractors updated for plan-aware hooks.

### Tests
- **208 new tests** across 9 new test files:
  - Plan schema and manager (80 tests)
  - Evidence schema (23 tests)
  - Evidence manager (25 tests)
  - Archive command (8 tests)
  - Evidence config (8 tests)
  - Guardrail profiles (35 tests)
  - Enhanced agent view (15 tests)
  - Packaging smoke tests (8 tests)
  - Injection budget (7 tests)
- **876 total tests** across 39 files (up from 668 in v4.6.0).

## [4.6.0] - 2026-02-09
### Added
- **Agent guardrails circuit breaker** — Two-layer protection against runaway subagents. Soft warning at 50% of configurable limits, hard block at 100%. Detection signals: tool call count, wall-clock duration, consecutive repetition (same tool+args hash), and consecutive errors (null/undefined output).
- **`GuardrailsConfig` schema** — Zod-validated configuration with 6 tunable fields (`enabled`, `max_tool_calls`, `max_duration_minutes`, `max_repetitions`, `max_consecutive_errors`, `warning_threshold`), all with sensible defaults and range validation.
- **Per-session agent state tracking** — `AgentSessionState` interface with `startAgentSession()`, `endAgentSession()`, `getAgentSession()` in `src/state.ts`. Includes stale session eviction (2-hour TTL).
- **`hashArgs()` utility** — Deterministic argument hashing for repetition detection, exported for testing.

### Changed
- Plugin entry (`src/index.ts`) now registers guardrails hooks (`tool.execute.before`, `tool.execute.after`, `experimental.chat.messages.transform`) composed with existing handlers via `composeHandlers()`.
- `guardrailsHooks.toolBefore` runs **without** `safeHook` wrapper so thrown errors propagate to block tool execution at circuit-breaker limits.

### Tests
- **46 new tests** — Guardrails hooks (31 tests), agent session state (7 tests), guardrails config schema (8 tests).
- **668 total tests** across 30 files (up from 622 in v4.5.0).

## [4.5.0] - 2026-02-07
### Fixed
- Replaced string concatenation with template literals in hooks (`agent-activity.ts`, `system-enhancer.ts`).
- Documented 7 `as any` casts in `src/index.ts` with `biome-ignore` comments explaining the Plugin API type limitation.
- Extracted `stripSwarmPrefix()` utility to eliminate 3 duplicate prefix-stripping blocks in `src/agents/index.ts`.

### Added
- **`/swarm-diagnose`** — Health check for `.swarm/` files, plan structure validation, and plugin configuration.
- **`/swarm-export`** — Export plan.md and context.md as portable JSON with version and timestamp.
- **`/swarm-reset --confirm`** — Clear `.swarm/` state files with safety confirmation gate.
- `stripSwarmPrefix()` utility function with input validation, exported for testing.

### Changed
- README.md updated with all v4.3.2–v4.5.0 features, 8 slash commands, CLI docs, and troubleshooting guide.
- Version badge updated to 4.5.0, test count updated to 622.

### Tests
- New test suites: `stripSwarmPrefix` (8 tests), diagnose command (7 tests), export command (7 tests), reset command (7 tests).
- **622 total tests** across 29 files (up from 592 in v4.4.0).

## [4.4.0] - 2026-02-07
### Changed
- Updated `@opencode-ai/plugin` and `@opencode-ai/sdk` to 1.1.53.
- Updated `@biomejs/biome` to 2.3.14.

### Added
- **CLI `uninstall` command** with `--clean` flag for removing the plugin from opencode.json and optionally cleaning up config files.
- **Custom error classes** (`SwarmError`, `ConfigError`, `HookError`, `ToolError`, `CLIError`) with actionable `guidance` messages for better DX.
- **`/swarm-history` slash command** — view completed phases from plan.md with status icons and task counts.
- **`/swarm-config` slash command** — view current resolved plugin configuration and config file paths.
- **Enhanced `safeHook` error logging** — SwarmError instances now include guidance text in warning output.

### Tests
- Expanded test coverage for hooks: extractors, system-enhancer, context-budget, agent-activity, delegation-tracker, compaction-customizer, pipeline-tracker (45 new edge case tests).
- Expanded test coverage for commands: status, plan, agents, dispatcher (14 new edge case tests).
- New test suites: CLI uninstall (9 tests), error classes (9 tests), history command (6 tests), config command (4 tests).
- **592 total tests** (up from 506 in v4.3.2).

## [4.3.2] - 2026-02-07
### Security
- **Path validation** — Added `validateSwarmPath()` to prevent directory traversal in `.swarm` file operations. Rejects null bytes, `..` traversal sequences, and paths escaping the `.swarm` directory. Windows-aware case-insensitive comparison.
- **Fetch hardening** — Added 10s timeout (AbortController), 5MB response size limit, and retry logic (2 retries with exponential backoff on 5xx/network errors) to the gitingest tool.
- **Deep merge depth limit** — Added `MAX_MERGE_DEPTH=10` to `deepMerge` to prevent stack overflow from deeply nested config objects.
- **Config file size limit** — Added `MAX_CONFIG_FILE_BYTES=102400` (100KB) check in `loadConfigFromPath` to prevent memory exhaustion from oversized config files.

### Added
- **23 new security-focused tests** (506 total) — Path validation (11), fetch hardening (7), merge depth limit (3), config size limit (2).

## [4.3.1] - 2026-02-07
### Fixed
- **Agent identity hardening** — Added `## IDENTITY` block at the top of all 6 subagent prompts (coder, explorer, sme, reviewer, critic, test_engineer) with explicit anti-delegation directives, WRONG/RIGHT examples, and explanation that @agent references in task payloads are orchestrator context, not delegation instructions. Fixes issue where subagents would attempt to delegate via the Task tool instead of doing work themselves.

### Added
- **36 new tests** (483 total) — Identity hardening tests verify anti-delegation markers in all subagent prompts.

## [4.3.0] - 2026-02-07
### Added
- **Hooks pipeline system** — `safeHook()` crash-safety wrapper and `composeHandlers()` for composing multiple handlers on the same hook type. Foundation for all v4.3.0 features.
- **System prompt enhancer** (`experimental.chat.system.transform`) — Injects current phase, task, and key decisions from `.swarm/` files into agent system prompts, keeping agents focused post-compaction.
- **Session compaction enhancer** (`experimental.session.compacting`) — Enriches OpenCode's built-in session compaction with plan.md phase info and context.md decisions.
- **Context budget tracker** (`experimental.chat.messages.transform`) — Estimates token usage and injects budget warnings at configurable thresholds (70%/90%). Supports per-model token limits.
- **Slash commands** — `/swarm-status`, `/swarm-plan [N]`, `/swarm-agents`. Registered via `config` hook and handled via `command.execute.before`.
- **Agent awareness: activity tracking** — `tool.execute.before`/`tool.execute.after` hooks track tool usage per agent. Flushes activity summary to `context.md` every 20 events with promise-based write lock.
- **Agent awareness: delegation tracker** — `chat.message` hook tracks active agent per session. Opt-in delegation chain logging (disabled by default).
- **Agent awareness: cross-agent context injection** — System enhancer reads Agent Activity section from context.md and injects relevant context labels (coder/reviewer/test_engineer) into system prompts. Configurable max chars (default: 300).
- **Shared swarm state** (`src/state.ts`) — Module-scoped singleton with zero imports. Tracks agent map, event counters, and flush locks. `resetSwarmState()` for testing.
- **238 new tests** (447 total, up from 209) across 12 new test files covering hooks, commands, state, and agent awareness.

### Changed
- **System enhancer** now also injects cross-agent context from the Agent Activity section of context.md.
- **Plugin entry** (`src/index.ts`) registers 7 hook types (up from 1): `experimental.chat.messages.transform`, `experimental.chat.system.transform`, `experimental.session.compacting`, `command.execute.before`, `tool.execute.before`, `tool.execute.after`, `chat.message`.
- **Pipeline tracker** refactored to use `safeHook()` wrapper.
- **Config schema** extended with `hooks` and `context_budget` groups for fine-grained feature control.

## [4.2.0] - 2026-02-07
### Added
- **Comprehensive test suite** — 209 unit tests across 9 test files using Bun's built-in test runner. Zero additional dependencies.
  - Config tests: constants (14), schema validation (27), config loader with XDG isolation (17)
  - Tools tests: domain detector (30), file extractor with temp dirs (16), gitingest with fetch mocking (5)
  - Agent tests: creation functions (64), factory + swarm prefixing (20)
  - Hooks tests: pipeline tracker transform behavior (16)
- Exported `deepMerge` from `src/config/loader.ts` and `extractFilename` from `src/tools/file-extractor.ts` for testability.

## [4.1.0] - 2026-02-06
### Added
- **Critic agent** — New plan review gate that evaluates the architect's plan BEFORE implementation begins. Returns APPROVED/NEEDS_REVISION/REJECTED verdicts with confidence scores and up to 5 prioritized issues. Includes AI-slop detection.
- **Phase 4.5 (Critic Gate)** in architect workflow — Mandatory plan review between planning and execution. Max 2 revision cycles before escalating to user.
- **Gap analysis** in Phase 2 discovery — Architect now makes a second explorer call focused on hidden requirements, unstated assumptions, and scope risks.

### Changed
- **Test engineer** now writes AND runs tests, reporting structured PASS/FAIL verdicts instead of only generating test files. 3-step workflow: write → run → report.
- **Architect prompt** updated with test execution delegation examples and verdict loop in Phase 5 (5d-5f).
- Updated all documentation (README.md, architecture.md, design-rationale.md, installation.md) to reflect new agent structure and workflow.

## [4.0.1] - 2026-02-06
### Fixed
- Strengthened architect review gate enforcement — explicit STOP instruction on REJECTED verdict to prevent proceeding to test generation before code review passes.

## [4.0.0] - 2026-02-06
### Changed
- **BREAKING:** Replaced 16 individual SME agents (sme_security, sme_vmware, sme_python, etc.) with a single open-domain `sme` agent. The architect determines the domain and the LLM's training provides expertise.
- **BREAKING:** Merged `security_reviewer` and `auditor` into a single `reviewer` agent. Architect specifies CHECK dimensions per review.
- **BREAKING:** Removed `_sme` and `_qa` category prefix config options.
- **BREAKING:** Config schema changes — `multi_domain_sme` and `auto_detect_domains` options removed.
- Agent count reduced from 20+ to 7 per swarm (architect, explorer, sme, coder, reviewer, test_engineer).
- Swarm identity managed exclusively through system prompt template variables ({{SWARM_ID}}, {{AGENT_PREFIX}}).
- Phase 0 now cleans up stale identity memory blocks on swarm mismatch.
