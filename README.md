<p align="center">
   <img src="https://img.shields.io/badge/version-6.9.0-blue" alt="Version">
   <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
   <img src="https://img.shields.io/badge/opencode-plugin-purple" alt="OpenCode Plugin">
   <img src="https://img.shields.io/badge/agents-9-orange" alt="Agents">
   <img src="https://img.shields.io/badge/tests-6000+-brightgreen" alt="Tests">
</p>

<h1 align="center">🐝 OpenCode Swarm</h1>

<p align="center">
  <strong>A structured multi-agent coding framework for OpenCode.</strong><br>
  Nine specialized agents. Persistent memory. A QA gate on every task. Code that ships.
</p>

<p align="center">
  <a href="#the-problem">The Problem</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#agents">Agents</a> •
  <a href="#persistent-memory">Memory</a> •
  <a href="#guardrails">Guardrails</a> •
  <a href="#comparison">Comparison</a> •
  <a href="#installation">Installation</a> •
  <a href="#roadmap">Roadmap</a>
</p>

---

## The Problem

Every multi-agent AI coding tool on the market has the same failure mode: they are vibes-driven. You describe a feature. Agents spawn. They race each other to write conflicting code, lose context after 20 messages, hit token limits mid-task, and produce something that sort-of-works until it doesn't. There's no plan. There's no memory. There's no gatekeeper. There's no test that was actually run.

**oh-my-opencode** is a prompt collection. **get-shit-done** is a workflow macro. Neither is a framework with memory, QA enforcement, or the ability to resume a project a week later exactly where you left off.

OpenCode Swarm is built differently.

```
Every other framework:
├── Agent 1 starts the auth module...
├── Agent 2 starts the user model... (conflicts with Agent 1)
├── Agent 3 writes tests... (for code that doesn't exist yet)
├── Context window fills up and the whole thing drifts
└── Result: chaos. Rework. Start over.

OpenCode Swarm:
├── Architect reads .swarm/plan.md → project already in progress, resumes Phase 2
├── @explorer scans the codebase for current state
├── @sme DOMAIN: security → consults on auth patterns, guidance cached
├── Architect writes .swarm/plan.md: 3 phases, 9 tasks, acceptance criteria per task
├── @critic reviews the plan → APPROVED
├── @coder implements Task 2.2 (one task, full context, nothing else)
├── diff tool → imports tool → lint fix → lint check → secretscan → @reviewer → @test_engineer
├── All gates pass → plan.md updated → Task 2.2: [x]
└── Result: working code, documented decisions, resumable project, evidence trail
```

---

## How It Works

### The Execution Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Phase 0: Resume Check                                                   │
│  .swarm/plan.md exists? Resume mid-task. New project? Continue.          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Phase 1: Clarify                                                        │
│  Ask only what the Architect cannot infer. Then stop.                    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Phase 2: Discover                                                       │
│  @explorer scans codebase → structure, languages, frameworks, key files  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Phase 3: SME Consult (serial, cached)                                   │
│  @sme DOMAIN: security, @sme DOMAIN: api, ...                            │
│  Guidance written to .swarm/context.md — never re-asked in future phases │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Phase 4: Plan                                                           │
│  Architect writes .swarm/plan.md                                         │
│  Structured phases, tasks with SMALL/MEDIUM/LARGE sizing, acceptance     │
│  criteria per task, explicit dependency graph                            │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Phase 4.5: Critic Gate                                                  │
│  @critic reviews plan → APPROVED / NEEDS_REVISION / REJECTED             │
│  Max 2 revision cycles. Escalates to user if unresolved.                 │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Phase 5: Execute (per task)                                             │
│                                                                          │
│  [UI task?] → @designer scaffold first                                   │
│                                                                          │
│  @coder (one task, full context)                                         │
│       ↓                                                                  │
│  diff tool  →  imports tool  →  lint fix  →  lint check  →  secretscan  │
│  (contract change detection)   (AST-based)  (auto-fix)   (entropy scan) │
│       ↓                                                                  │
│  @reviewer (correctness pass)                                            │
│       ↓ APPROVED                                                         │
│  @reviewer (security-only pass, if file matches security globs)          │
│       ↓ APPROVED                                                         │
│  @test_engineer (verification tests + coverage gate ≥70%)               │
│       ↓ PASS                                                             │
│  @test_engineer (adversarial tests — boundary violations, injections)    │
│       ↓ PASS                                                             │
│  plan.md → [x] Task complete                                             │
│                                                                          │
│  Any gate fails → back to @coder with structured rejection reason        │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Phase 6: Phase Complete                                                 │
│  @explorer rescans. @docs updates documentation. Retrospective written.  │
│  Learnings injected as [SWARM RETROSPECTIVE] into next phase.            │
│  "Phase 1 complete (4 tasks, 0 rejections). Ready for Phase 2?"          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Why Serial Execution Matters

Multi-agent parallelism sounds fast. In practice, it is a race to produce conflicting, unreviewed code that requires a human to untangle. OpenCode Swarm runs one task at a time through a deterministic pipeline. Every task is reviewed. Every test is run. Every failure is documented and fed back to the coder with structured context. The tradeoff in raw speed is paid back in not redoing work.

---

## Agents

### 🎯 Orchestrator

**`architect`** — The central coordinator. Owns the plan, delegates all work, enforces every QA gate, maintains project memory, and resumes projects across sessions. Every other agent works for the Architect.

### 🔍 Discovery

**`explorer`** — Fast codebase scanner. Identifies structure, languages, frameworks, key files, and import patterns. Runs before planning and after every phase completes.

### 🧠 Domain Expert

**`sme`** — Open-domain expert. The Architect specifies any domain per call: `security`, `python`, `rust`, `kubernetes`, `ios`, `ml`, `blockchain` — any domain the underlying model has knowledge of. No hardcoded list. Guidance is cached in `.swarm/context.md` so the same question is never asked twice.

### 🎨 Design

**`designer`** — UI/UX specification agent. Opt-in via config. Generates component scaffolds and design tokens before the coder touches UI tasks, eliminating the most common source of front-end rework.

### 💻 Implementation

**`coder`** — Implements exactly one task with full context. No multitasking. No context bleed from prior tasks. The coder receives: the task spec, acceptance criteria, SME guidance, and relevant context from `.swarm/context.md`. Nothing else.

**`test_engineer`** — Generates tests, runs them, and returns structured `PASS/FAIL` verdicts with coverage percentages. Runs twice per task: once for verification, once for adversarial attack scenarios.

### ✅ Quality Assurance

**`reviewer`** — Dual-pass review. First pass: correctness, logic, maintainability. Second pass: security-only, scoped to OWASP Top 10 categories, triggered automatically when the modified files match security-sensitive path patterns. Both passes produce structured verdicts with specific rejection reasons.

**`critic`** — Plan review gate. Reviews the Architect's plan *before implementation begins*. Checks for completeness, feasibility, scope creep, missing dependencies, and AI-slop hallucinations. Plans do not proceed without Critic approval.

### 📝 Documentation

**`docs`** — Documentation synthesizer. Runs in Phase 6 with a diff of changed files. Updates READMEs, API documentation, and guides to reflect what was actually built, not what was planned.

---

## Persistent Memory

Other frameworks lose everything when the session ends. Swarm stores project state on disk.

```
.swarm/
├── plan.md          # Living roadmap: phases, tasks, status, rejections, blockers
├── plan.json        # Machine-readable plan for tooling
├── context.md       # Institutional knowledge: decisions, SME guidance, patterns
├── evidence/        # Execution evidence records (and optional bundles)
│   ├── 1_1-review.json  # Review evidence for task 1.1
│   ├── 1_1-test.json    # Test evidence for task 1.1
│   ├── 2_3-diff.json    # Diff evidence for task 2.3
│   └── 2.3/evidence.json # Optional: bundle aggregation for task 2.3
└── history/
    ├── phase-1.md   # What was built, what was learned, retrospective metrics
    └── phase-2.md
```

### plan.md — Living Roadmap

```markdown
# Project: Auth System
Current Phase: 2

## Phase 1: Foundation [COMPLETE]
- [x] Task 1.1: Create user model [SMALL]
- [x] Task 1.2: Add password hashing [SMALL]
- [x] Task 1.3: Database migrations [MEDIUM]

## Phase 2: Core Auth [IN PROGRESS]
- [x] Task 2.1: Login endpoint [MEDIUM]
- [ ] Task 2.2: JWT generation [MEDIUM] (depends: 2.1) ← CURRENT
  - Acceptance: Returns valid JWT with user claims, 15-minute expiry
  - Attempt 1: REJECTED — missing expiration claim
- [ ] Task 2.3: Token validation middleware [MEDIUM]
- [BLOCKED] Task 2.4: Refresh token rotation
  - Reason: Awaiting decision on rotation strategy
```

### context.md — Institutional Knowledge

```markdown
# Project Context: Auth System

## Technical Decisions
- bcrypt cost factor: 12
- JWT TTL: 15 minutes; refresh TTL: 7 days
- Refresh token store: Redis with key prefix auth:refresh:

## SME Guidance Cache
### security (Phase 1)
- Never log tokens or passwords in any context
- Use constant-time comparison for all token equality checks
- Rate-limit login endpoint: 5 attempts / 15 minutes per IP

### api (Phase 1)
- Return HTTP 401 for invalid credentials (not 404)
- Include token expiry timestamp in response body

## Patterns Established
- Error handling: custom ApiError class with HTTP status and error code
- Validation: Zod schemas in /validators/, applied at request boundary
```

Start a new session tomorrow. The Architect reads these files and picks up exactly where you left off — no re-explaining, no rediscovery, no drift.

### Evidence Bundles

Each completed task writes structured evidence to `.swarm/evidence/`:

| Type | What It Captures |
|------|-----------------|
| `review` | Verdict (APPROVED/REJECTED), risk level, specific issues |
| `test` | Pass/fail counts, coverage percentage, failure messages |
| `diff` | Files changed, additions/deletions, contract change flags |
| `approval` | Stakeholder sign-off with notes |
| `retrospective` | Phase metrics: total tool calls, coder revisions, reviewer rejections, test failures, security findings, lessons learned |

Evidence records are written as individual JSON files named `<major>_<minor>-<type>.json` (e.g. `2_2-review.json`) where `task_id` and `type` inside the JSON must match the filename.

Retrospectives from completed phases are injected as `[SWARM RETROSPECTIVE]` hints at the start of subsequent phases. The framework learns from its own history within a project.

---

## Heterogeneous Models

Single-model frameworks have correlated failure modes. The same model that writes the bug reviews it and misses it. Swarm lets you route each agent to the model it is best suited for:

```json
{
  "agents": {
    "architect": { "model": "anthropic/claude-opus-4-6", "variant": "high" },
    "coder": { "model": "minimax-coding-plan/MiniMax-M2.5", "variant": "medium" },
    "explorer": { "model": "minimax-coding-plan/MiniMax-M2.1" },
    "sme": { "model": "kimi-for-coding/k2p5" },
    "critic": { "model": "zai-coding-plan/glm-5" },
    "reviewer": { "model": "zai-coding-plan/glm-5" },
    "test_engineer": { "model": "minimax-coding-plan/MiniMax-M2.5" },
    "docs": { "model": "zai-coding-plan/glm-4.7-flash" },
    "designer": { "model": "kimi-for-coding/k2p5" }
  }
}
```

Reviewer uses a different model than Coder by design. Different training, different priors, different blind spots. This is the cheapest bug-catcher you will ever deploy.

---

## Guardrails

Every subagent runs inside a circuit breaker that kills runaway behavior before it burns credits on a stuck loop.

| Layer | Trigger | Action |
|-------|---------|--------|
| ⚠️ Soft Warning | 50% of any limit reached | Warning injected into agent stream |
| 🛑 Hard Block | 100% of any limit reached | All further tool calls blocked |

| Signal | Default | Description |
|--------|---------|-------------|
| Tool calls | 200 | Per-invocation, not per-session |
| Duration | 30 min | Wall-clock time per delegation |
| Repetition | 10 | Same tool + args consecutively |
| Consecutive errors | 5 | Sequential null/undefined outputs |

Limits are enforced **per-invocation**. Each delegation to a subagent starts a fresh budget. A coder fixing a second task is not penalized for the first task's tool calls. The Architect is exempt from all limits by default.

Per-agent profiles allow fine-grained overrides:

```jsonc
{
  "guardrails": {
    "max_tool_calls": 200,
    "profiles": {
      "coder":    { "max_tool_calls": 500, "max_duration_minutes": 60 },
      "explorer": { "max_tool_calls": 50 }
    }
  }
}
```

---

## Comparison

| Feature | OpenCode Swarm | oh-my-opencode | get-shit-done | AutoGen | CrewAI |
|---------|:-:|:-:|:-:|:-:|:-:|
| Multi-agent orchestration | ✅ 9 specialized agents | ❌ Prompt config only | ❌ Single-agent macros | ✅ | ✅ |
| Execution model | Serial (deterministic) | N/A | N/A | Parallel (chaotic) | Parallel |
| Phased planning with acceptance criteria | ✅ | ❌ | ❌ | ❌ | ❌ |
| Critic gate before implementation | ✅ | ❌ | ❌ | ❌ | ❌ |
| Per-task dual-pass review (correctness + security) | ✅ | ❌ | ❌ | Optional | Optional |
| Adversarial test pass per task | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pre-reviewer pipeline (lint, secretscan, imports) | ✅ v6.3 | ❌ | ❌ | ❌ | ❌ |
| Persistent session memory | ✅ `.swarm/` files | ❌ | ❌ | Session only | Session only |
| Resume projects across sessions | ✅ Native | ❌ | ❌ | ❌ | ❌ |
| Evidence trail per task | ✅ Structured bundles | ❌ | ❌ | ❌ | ❌ |
| Heterogeneous model routing | ✅ Per-agent | ❌ | ❌ | Limited | Limited |
| Circuit breaker / guardrails | ✅ Per-invocation | ❌ | ❌ | ❌ | ❌ |
| Open-domain SME consultation | ✅ Any domain | ❌ | ❌ | ❌ | ❌ |
| Retrospective learning across phases | ✅ | ❌ | ❌ | ❌ | ❌ |
| Slash commands + diagnostics | ✅ canonical `/swarm-*` commands | ❌ | Limited | ❌ | ❌ |

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/swarm-status` | Current phase, task progress, agent count |
| `/swarm-plan [phase]` | Full plan or filtered by phase |
| `/swarm-agents` | All registered agents with models and permissions |
| `/swarm-history` | Completed phases with status |
| `/swarm-config` | Current resolved configuration |
| `/swarm-config-doctor [--fix] [--restore <id>]` | Config validation with optional auto-fix (v6.7) |
| `/swarm-doctor` | Run doctor diagnostics command |
| `/swarm-evidence [task]` | Evidence bundles for a task or all tasks |
| `/swarm-evidence-summary` | Generate evidence completion summary |
| `/swarm-archive [--dry-run]` | Archive old evidence with retention policy |
| `/swarm-diagnose` | Health check for `.swarm/` files and config |
| `/swarm-preflight` | Run phase preflight checks (v6.7) |
| `/swarm-sync-plan` | Force plan.md regeneration from plan.json (v6.7) |
| `/swarm-benchmark` | Performance benchmarks |
| `/swarm-export` | Export plan and context as portable JSON |
| `/swarm-reset --confirm` | Clear swarm state files |
| `/swarm-retrieve [id]` | Retrieve auto-summarized tool outputs |

---

## Configuration

```json
{
  "agents": {
    "architect": { "model": "anthropic/claude-opus-4-6", "variant": "high" },
    "coder": { "model": "minimax-coding-plan/MiniMax-M2.5", "variant": "medium" },
    "explorer": { "model": "minimax-coding-plan/MiniMax-M2.1" },
    "sme": { "model": "kimi-for-coding/k2p5" },
    "critic": { "model": "zai-coding-plan/glm-5" },
    "reviewer": { "model": "zai-coding-plan/glm-5" },
    "test_engineer": { "model": "minimax-coding-plan/MiniMax-M2.5" },
    "docs": { "model": "zai-coding-plan/glm-4.7-flash" },
    "designer": { "model": "kimi-for-coding/k2p5" }
  },
  "guardrails": {
    "max_tool_calls": 200,
    "max_duration_minutes": 30,
    "profiles": {
      "coder": { "max_tool_calls": 500 }
    }
  },
  "review_passes": {
    "always_security_review": false,
    "security_globs": ["**/*auth*", "**/*crypto*", "**/*session*", "**/*token*"]
  },
  "automation": {
    "mode": "manual",
    "capabilities": {
      "plan_sync": false,
      "phase_preflight": false,
      "config_doctor_on_startup": false,
      "config_doctor_autofix": false,
      "evidence_auto_summaries": false,
      "decision_drift_detection": false
    }
  }
}
```

`variant` accepts any non-empty string; recommended values are `low`, `medium`, or `high` (exact values are provider/model specific).

`reasoningEffort` is kept as a backwards-compatible alias and maps to `variant`.

When `swarms` is configured (non-empty), top-level legacy `agents` overrides are ignored. Example: if `agents.coder.variant` is `high` but `swarms.local.agents.coder.variant` is unset, `local_coder` does not inherit `high`.

Save to `~/.config/opencode/opencode-swarm.json` or `.opencode/swarm.json` in your project root. Project config merges over global config via deep merge — partial overrides do not clobber unspecified fields.

### Automation (v6.7)

**Default mode: `manual`** (no background automation). Enable automation features via `automation` config:

```json
{
  "automation": {
    "mode": "hybrid",
    "capabilities": {
      "plan_sync": true,
      "config_doctor_on_startup": true,
      "evidence_auto_summaries": true
    }
  }
}
```

**Automation modes:**
- `manual` - No background automation (default)
- `hybrid` - Background automation for safe ops, manual for sensitive ones
- `auto` - Full background automation (target state)

**Per-feature flags (all default `false`):**
- `plan_sync` - Auto-regenerate plan.md from plan.json when out of sync
- `phase_preflight` - Phase-boundary validation before agent execution
- `config_doctor_on_startup` - Config validation on plugin initialization
- `config_doctor_autofix` - Auto-fix mode for Config Doctor (requires explicit opt-in)
- `evidence_auto_summaries` - Auto-generate evidence summaries
- `decision_drift_detection` - Detect drift between planned and actual decisions

### Disabling Agents

```json
{
  "sme":          { "disabled": true },
  "designer":     { "disabled": true },
  "test_engineer": { "disabled": true }
}
```

---

## Installation

```bash
# Install globally
npm install -g opencode-swarm

# Or use npx
npx opencode-swarm install

# Verify
opencode  # then: /swarm-diagnose
```

The installer auto-configures `opencode.json` to include the plugin. Manual configuration:

```json
{
  "plugins": ["opencode-swarm"]
}
```

---

## Testing

4008 tests across 136 files. Unit, integration, adversarial, and smoke. Covers config schemas, all agent prompts, all hooks, all tools, all commands, guardrail circuit breaker, race conditions, invocation window isolation, multi-invocation state, security category classification, evidence validation, background workers, phase-monitor hooks, and evidence-summary automation.

```bash
bun test
```

Zero additional test dependencies. Uses Bun's built-in test runner.

---

## Quality Gates (v6.9.0)

### syntax_check - Tree-sitter Parse Validation
Validates syntax across 9+ languages using Tree-sitter parsers. Catches syntax errors before review.

### placeholder_scan - Anti-Slop Detection  
Detects TODO/FIXME comments, placeholder text, and stub implementations. Prevents shipping incomplete code.

### sast_scan - Static Security Analysis
Offline SAST with 63+ security rules across 9 languages. Optional Semgrep Tier B enhancement if available on PATH.

### sbom_generate - Dependency Tracking
Generates CycloneDX SBOMs from manifests/lock files. Tracks dependencies for 8 ecosystems.

### build_check - Build Verification
Runs repo-native build/typecheck commands. Ensures code compiles before review.

### quality_budget - Maintainability Enforcement
Enforces complexity, API, duplication, and test-to-code ratio budgets. Configurable thresholds.

### Local-Only Guarantee
All v6.9.0 quality tools run locally without:
- Docker containers
- Network connections
- External APIs
- Cloud services

Optional enhancement: Semgrep (if already on PATH)

### Configuration
Configure gates in `.opencode/swarm.json`:

```json
{
  "gates": {
    "syntax_check": { "enabled": true },
    "placeholder_scan": { "enabled": true },
    "sast_scan": { "enabled": true },
    "sbom_generate": { "enabled": true },
    "build_check": { "enabled": true },
    "quality_budget": {
      "enabled": true,
      "max_complexity_delta": 5,
      "max_public_api_delta": 10,
      "max_duplication_ratio": 0.05,
      "min_test_to_code_ratio": 0.3
    }
  }
}
```

---

## Roadmap

### v6.3 — Pre-Reviewer Pipeline

Three new tools complete the pre-reviewer gauntlet. Code reaching the Reviewer is already clean.

- **`imports`** — AST-based import graph. For each file changed by the coder, returns every consumer file, which exports each consumer uses, and the line numbers. Replaces fragile grep-based integration analysis with deterministic graph traversal.
- **`lint`** — Auto-detects project linter (Biome, ESLint, Ruff, Clippy, PSScriptAnalyzer). Runs in fix mode first, then check mode. Structured diagnostic output per file.
- **`secretscan`** — Entropy-based credential scanner. Detects API keys, tokens, connection strings, and private key headers in the diff before they reach the reviewer. Zero external dependencies.

Phase 5 execute loop becomes: `coder → diff → imports → lint fix → lint check → secretscan → reviewer → security reviewer → test_engineer → adversarial test_engineer`.

### v6.4 — Execution and Planning Tools

- **`test_runner`** — Unified test execution across Bun, Vitest, Jest, Mocha, pytest, cargo test, and Pester. Auto-detects framework, returns normalized JSON with pass/fail/skip counts and coverage. Three scope modes: `all`, `convention` (naming-based), `graph` (import-graph-based). Eliminates the test_engineer's most common failure mode.
- **`symbols`** — Export inventory for a module: functions, classes, interfaces, types, enums. Gives the Architect instant visibility into a file's public API surface without reading the full source.
- **`checkpoint`** — Git-backed save points. Before any multi-file refactor (≥3 files), Architect auto-creates a checkpoint commit. On critical integration failure, restores via soft reset instead of iterating into a hole.

### v6.5 — Intelligence and Audit Tools

Five tools that improve planning quality and post-phase validation:

- **`pkg_audit`** — Wraps `npm audit`, `pip-audit`, `cargo audit`. Structured CVE output with severity, patched versions, and advisory URLs. Fed to the security reviewer for concrete vulnerability context.
- **`complexity_hotspots`** — Git churn × cyclomatic complexity risk map. Run in Phase 0/2 to identify modules that need stricter QA gates before implementation begins.
- **`schema_drift`** — Compares OpenAPI spec against actual route implementations. Surfaces undocumented routes and phantom spec paths. Run in Phase 6 when API routes were modified.
- **`todo_extract`** — Structured extraction of `TODO`, `FIXME`, and `HACK` annotations across the codebase. High-priority items fed directly into plan task candidates.
- **`evidence_check`** — Audits completed tasks against required evidence types. Run in Phase 6 to verify every task has review and test evidence before the phase is marked complete.

---

## Design Principles

1. **Plan before code** — Documented phases with acceptance criteria. The Critic approves the plan before a single line is written.
2. **One task at a time** — The Coder gets one task and full context. Nothing else.
3. **Review everything immediately** — Every task goes through correctness review, security review, verification tests, and adversarial tests. No task ships without passing all four.
4. **Cache SME knowledge** — Guidance is written to `context.md`. The same domain question is never asked twice in a project.
5. **Persistent memory** — `.swarm/` files are the ground truth. Any session, any model, any day.
6. **Serial execution** — Predictable, debuggable, no race conditions, no conflicting writes.
7. **Heterogeneous models** — Different models, different blind spots. The coder's bug is the reviewer's catch.
8. **User checkpoints** — Phase transitions require user confirmation. No unsupervised multi-phase runs.
9. **Document failures** — Rejections and retries are recorded in plan.md. After 5 failed attempts, the task escalates to the user.
10. **Resumable by design** — A cold-start Architect can read `.swarm/` and continue any project as if it had been there from the beginning.

---

## Documentation

- [Architecture Deep Dive](docs/architecture.md)
- [Design Rationale](docs/design-rationale.md)
- [Installation Guide](docs/installation.md)
- [Linux + Native Windows + Docker Desktop Install Guide](docs/installation-linux-docker.md)
- [LLM Operator Install Guide](docs/installation-llm-operator.md)

---

## License

MIT

---

<p align="center">
  <strong>Stop hoping your agents figure it out. Start shipping code that actually works.</strong>
</p>
