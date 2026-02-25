# opencode-swarm — Phased Implementation Plan (Local-Only Quality + Anti-Slop Tooling)

## Scope
Implement six new/expanded capabilities, all **local-only** (no Docker requirement, no network requirement), integrated into the Phase 5 execution loop and CI gate:

1. `syntax_check` — Tree-sitter parse validation across top languages + web/mobile.
2. `placeholder_scan` — AST-aware placeholder / stub / TODO slop gate.
3. `sast_scan` — Offline SAST (bundled rules) with optional Semgrep-on-PATH upgrade.
4. `sbom_generate` — Offline CycloneDX SBOM generation from manifests/locks.
5. `build_check` — Deterministic build/typecheck runner (repo-native only).
6. `quality_budget` — Enforceable maintainability budgets + `/swarm benchmark --ci-gate` integration.

These extend the existing roadmap direction (pre-reviewer gauntlet, unified runners, CI gate).  
Existing Phase 5 sequence baseline: `coder → diff → imports → lint fix → lint check → secretscan → reviewer → security reviewer → test_engineer → adversarial test_engineer`. fileciteturn3file0L48-L57

---

## Non-Goals
- No containerized analyzers.
- No network-based vulnerability correlation for SBOM (generation only).
- No mandatory installation of external CLIs; external CLIs may be used **only if already present** (best-effort mode).

---

## Global Acceptance Criteria
- `bun test` passes with added coverage for every new tool, prompt gate, and CI-gate rule. fileciteturn3file0L34-L43
- New tools produce **normalized JSON** outputs compatible with evidence aggregation and benchmarking.
- New gates are **non-bypassable** in Architect workflow prompts (same enforcement pattern used for `secretscan` and reviewer ordering). fileciteturn3file1L13-L35
- All new features are configurable with sane defaults in swarm config (`~/.config/opencode/opencode-swarm.json` or `.opencode/swarm.json`). fileciteturn3file4L32-L33

---

# Phase 0 — Baseline Recon + Design Freeze

## 0.1 Inventory existing tool framework
**Owner:** explorer → architect  
**Task:**
- Locate existing tool registration, execution wrapper, and evidence writing paths.
- Identify where Phase 5 gating sequence is defined (agent prompt templates + enforcement tests).
- Identify existing benchmark/CI-gate implementation and how thresholds are defined. fileciteturn3file2L30-L85

**Acceptance:**
- A short internal note in repo (e.g., `docs/dev/phase0-tool-architecture.md`) describing:
  - Tool interface contract (input/output/error).
  - Evidence file schema(s) and storage path.
  - How CI-gate consumes aggregates.

## 0.2 Decide language coverage set (local parsers)
**Owner:** architect  
**Task:**
- Adopt a first-pass coverage list aligned to “top-10 overall + web + mobile”:
  - JS/TS, Python, Java, C, C++, C#, Go, Rust, PHP
  - Plus: HTML, CSS, Kotlin, Swift, Dart (Flutter)
- Confirm file extensions mapping for each language for both Tree-sitter parse and placeholder scanning.

**Acceptance:**
- `src/lang/registry.ts` (or equivalent) defined with:
  - language id
  - extensions
  - tree-sitter parser loader key
  - comment node types (for placeholder scanning)

---

# Phase 1 — `syntax_check` Tool (Tree-sitter Parse Gate)

## 1.1 Add Tree-sitter runtime + parsers (packaged)
**Owner:** coder  
**Task:**
- Add Tree-sitter runtime dependency suitable for Bun/Node packaging.
- Vendor/compile Tree-sitter grammars for the selected language set.
- Implement a parser loader that is deterministic and does not shell out.

**Acceptance:**
- `syntax_check` can parse a representative sample file from each supported language.
- Runs without external binaries.

## 1.2 Implement tool: `syntax_check`
**Owner:** coder  
**Tool Contract:**
- **Input:** `{ changed_files: string[], mode: "changed" | "all", languages?: string[] }`
- **Output (JSON):**
  - `verdict: "pass"|"fail"`
  - `files: [{ path, language, ok, errors: [{ line, column, message }] }]`
  - `summary: { files_checked, files_failed }`

**Behavior:**
- Default mode: parse only `diff`-reported changed files.
- Skip binary files and files above a size threshold (configurable), returning `skipped` entries explicitly.

**Acceptance:**
- Unit tests:
  - Fails on invalid syntax for JS/TS/Python.
  - Passes on valid minimal files.
  - Handles unknown extensions as `skipped`.

## 1.3 Wire into Phase 5 mandatory sequence
**Owner:** architect → coder  
**Task:**
- Update Architect prompt template: `coder → diff → syntax_check → imports → lint fix → lint check → secretscan → ...`
- Add anti-bypass tests similar to secretscan enforcement. fileciteturn3file1L13-L35

**Acceptance:**
- Prompt tests confirm:
  - `syntax_check` is mandatory and ordered before `imports`.
  - Failures force return to coder.

---

# Phase 2 — `placeholder_scan` Tool (Anti-Slop Gate)

## 2.1 Define placeholder policy + config
**Owner:** architect  
**Task:**
- Add config block:
  - `placeholder_scan.enabled` default `true`
  - `deny_patterns` (default list)
  - `allow_globs` (docs/examples/tests/mocks)
  - `max_allowed_findings` default `0` for production paths

**Default deny patterns (initial):**
- TODO/FIXME/TBD/XXX
- “placeholder”, “stub”, “wip”, “not implemented”
- `throw new Error("TODO")`, `return null` / `return 0` / `return true` in non-test code when surrounded by placeholder markers

**Acceptance:**
- Config schema validates and merges correctly (global + project override). fileciteturn3file4L32-L33

## 2.2 Implement tool: `placeholder_scan`
**Owner:** coder  
**Implementation:**
- For supported languages: use Tree-sitter to traverse:
  - comment nodes
  - string literal nodes
  - function bodies for “stubby” minimal returns/throws (heuristic)
- For unsupported languages: fallback to line-based scanning with strict globs.

**Tool Contract:**
- **Input:** `{ changed_files: string[], allow_globs?: string[], deny_patterns?: string[] }`
- **Output:** `verdict`, `findings: [{ path, line, kind, excerpt, rule_id }]`, `summary`

**Acceptance:**
- Tests:
  - `TODO` in `src/` causes fail.
  - `TODO` in `docs/` is allowed.
  - Stub function detected when marked with placeholder text.

## 2.3 Wire into Phase 5 mandatory sequence
**Owner:** architect → coder  
**Task:**
- Update prompt sequence: `diff → syntax_check → placeholder_scan → imports → ...`
- Add non-bypass tests.

**Acceptance:**
- Prompt tests confirm placeholder findings block progression to reviewer.

---

# Phase 3 — `sast_scan` Tool (Offline SAST + Optional Semgrep)

## 3.1 Ship offline rule engine (Tier A)
**Owner:** coder  
**Task:**
- Implement minimal rule engine using:
  - Tree-sitter queries (preferred) per language, and/or
  - token/AST heuristics for high-signal patterns.
- Initial rule set (high-signal, low false-positive):
  - JS/TS: `eval`, `Function(...)`, unsanitized `child_process.exec`, dangerous regex backtracking hotspots (basic)
  - Python: `pickle.loads`, `subprocess.*(shell=True)`, `yaml.load` without SafeLoader
  - Go: `exec.Command("sh","-c",...)`, weak TLS config patterns
  - Java: `Runtime.exec`, insecure deserialization patterns
  - PHP: `unserialize`, `exec/system`
  - C/C++: `strcpy/strcat/sprintf` to fixed buffers (heuristic)
  - C#: `Process.Start` with interpolated command strings

**Acceptance:**
- Rule execution returns structured findings with stable `rule_id`, `severity`, and location.

## 3.2 Optional Semgrep upgrade (Tier B)
**Owner:** coder  
**Task:**
- If `semgrep` exists on PATH, run it with a **bundled local config** (no remote rules).
- Merge Tier B findings into same output schema.

**Acceptance:**
- With `semgrep` absent: tool still runs and returns Tier A results.
- With `semgrep` present: tool includes `engine: "tier_a+tier_b"` metadata.

## 3.3 Wire into Phase 5 sequence + Security reviewer handoff
**Owner:** architect  
**Task:**
- Insert `sast_scan` after `secretscan` and before general reviewer (or immediately before security reviewer).
- Update security reviewer prompt to explicitly consider `sast_scan` findings as blocking.

**Acceptance:**
- Prompt tests verify ordering and block behavior for findings.

---

# Phase 4 — `sbom_generate` Tool (CycloneDX Offline)

## 4.1 Implement manifest/lock detectors
**Owner:** coder  
**Task:**
- Detect and parse:
  - Node: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`
  - Python: `requirements.txt`, `poetry.lock`, `pipfile.lock`
  - Rust: `Cargo.lock`
  - Go: `go.sum`
  - Java: `pom.xml` (best-effort), `gradle.lockfile` if present
  - .NET: `packages.lock.json` / `paket.lock` if present
  - Swift: `Package.resolved`
  - Dart/Flutter: `pubspec.lock`

**Acceptance:**
- For each format, extract component name + version (or resolved ref) deterministically.

## 4.2 Emit CycloneDX JSON
**Owner:** coder  
**Task:**
- Produce `bom.json` compliant structure (minimal required fields):
  - `bomFormat`, `specVersion`, `version`
  - `components[]` with `name`, `version`, `type`
  - metadata: timestamp, tool info

**Acceptance:**
- Output validates against a minimal internal JSON schema (no network validation).

## 4.3 Evidence integration and Phase positioning
**Owner:** architect  
**Task:**
- Run `sbom_generate` in:
  - Phase 0/2 (baseline snapshot)
  - Phase 6 (post-implementation snapshot + diff)
- Store artifacts under evidence directory, e.g. `.swarm/evidence/sbom/*.json`.

**Acceptance:**
- Benchmark command can count SBOM artifacts as evidence type (optional display).

---

# Phase 5 — `build_check` Tool (Repo-native Build/Typecheck)

## 5.1 Command discovery strategy (no new deps)
**Owner:** architect → coder  
**Task:**
- Implement detection order:
  1. Repo-defined scripts (package.json scripts: `build`, `typecheck`, `check`)
  2. Standard build files (Cargo.toml, go.mod, *.sln/*.csproj, pom.xml, build.gradle, Package.swift, pubspec.yaml, etc.)
  3. Only run if toolchain exists on PATH (best-effort), otherwise return `skipped` with reason.

**Acceptance:**
- No failures due solely to missing toolchains unless CI explicitly demands.

## 5.2 Implement tool: `build_check`
**Owner:** coder  
**Tool Contract:**
- **Input:** `{ scope: "changed"|"all", changed_files?: string[], mode: "build"|"typecheck"|"both" }`
- **Output:** `{ verdict, runs: [{ kind, command, cwd, exit_code, duration_ms, stdout_tail, stderr_tail }], summary }`

**Acceptance:**
- Uses consistent truncation (`*_tail`) to keep evidence small.
- Produces deterministic output for the same inputs.

## 5.3 Wire into Phase 5 gate
**Owner:** architect  
**Task:**
- Insert `build_check` after `sast_scan` (or after `lint`) and before reviewer.
- Update prompts/tests to make it non-skippable when not skipped for missing toolchain.

**Acceptance:**
- Prompt explicitly encodes: “SKIPPED (no toolchain) → proceed; FAILED → return to coder”.

---

# Phase 6 — `quality_budget` Expansion + CI Gate

The repo already computes quality aggregates and supports `--ci-gate` thresholds for review/test pass rates, agent error rate, and hard limit hits. fileciteturn3file2L30-L85

## 6.1 Define new budgets + config
**Owner:** architect  
**Task:**
- Add `quality_budget` config:
  - `max_complexity_delta`
  - `max_public_api_delta`
  - `max_duplication_delta`
  - `min_test_to_code_ratio`
  - `enforce_on_globs` (e.g., `src/**`, exclude `docs/**`)

**Acceptance:**
- Config schema validated and defaults documented.

## 6.2 Implement metrics
**Owner:** coder  
**Task:**
- Complexity delta:
  - Prefer Tree-sitter node/branch heuristics per language.
  - Store per-file baseline vs post metrics for changed files.
- Public API delta:
  - Use/extend `symbols` tool concept to count exports/decls. fileciteturn3file0L60-L62
- Duplication delta:
  - Tokenize changed hunks; compute repeated n-gram ratios across hunks.
- Test-to-code ratio:
  - Use diff additions/deletions for production vs test globs.

**Acceptance:**
- Emit `.swarm/quality.json` with stable fields.

## 6.3 Integrate into `/swarm benchmark --ci-gate`
**Owner:** coder  
**Task:**
- Add new checks to the existing CI-gate check list.
- Ensure JSON block remains parseable (existing tests already assert parseability). fileciteturn3file3L78-L85

**Acceptance:**
- New CI-gate tests:
  - Fails when complexity delta exceeds threshold.
  - Fails when API delta exceeds threshold.
  - Passes when within thresholds.
- CLI output includes the new check rows alongside existing checks.

---

# Phase 7 — End-to-End Prompt + Evidence Contract Hardening

## 7.1 Update Architect mandatory QA gate text
**Owner:** architect  
**Task:**
- Ensure Phase 5 gate section explicitly enumerates:
  - `diff`
  - `syntax_check`
  - `placeholder_scan`
  - `imports`
  - `lint` (fix + check)
  - `secretscan`
  - `sast_scan`
  - `build_check`
  - `reviewer`
  - `security reviewer`
  - `test_runner` / `test_engineer` (existing)
- Use the same explicit FINDINGS/NO FINDINGS branching language used for `secretscan`. fileciteturn3file1L27-L35

**Acceptance:**
- Prompt tests verify ordering and non-bypassability for all new gates.

## 7.2 Evidence schemas
**Owner:** coder  
**Task:**
- Extend evidence writer to support new evidence `type` values:
  - `syntax`, `placeholder`, `sast`, `sbom`, `build`, `quality_budget`
- Ensure benchmark aggregator tolerates unknown evidence types gracefully.

**Acceptance:**
- End-to-end test simulates evidence set and benchmark output remains correct.

---

# Phase 8 — Documentation + Release

## 8.1 README updates
**Owner:** docs agent  
**Task:**
- Document:
  - New tools (purpose + where they run)
  - Local-only guarantee
  - Optional Semgrep enhancement behavior
  - New CI-gate thresholds and how to configure them

**Acceptance:**
- README “Roadmap” updated to include these capabilities alongside existing v6.3–v6.5 sections. fileciteturn3file0L46-L70

## 8.2 Versioning + changelog
**Owner:** architect  
**Task:**
- Choose version bump (e.g., v6.6/v6.7) consistent with roadmap style.
- Add changelog entries focused on quality/anti-slop improvements.

**Acceptance:**
- Release notes include configuration snippets and minimal upgrade steps.

---

## Execution Notes for Swarm Operator
- Always implement one tool end-to-end (tool + prompts + tests) before starting the next.
- Do not introduce new runtime requirements beyond what the plugin already installs (Bun/Node + packaged deps).
- Treat any “skip” path as explicit structured output, never silent skipping.
