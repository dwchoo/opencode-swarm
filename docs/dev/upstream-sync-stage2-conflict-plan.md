# Upstream Core Sync - Stage 2 Conflict Review Plan

Date: 2026-02-27

## Scope

- Cherry-picked upstream core commits:
  - `7b10821` (`checkpoint: Stage 1 implementation before QA gate review`)
  - `bfce268` (`v6.9.0: Quality & Anti-Slop Tooling`)
  - `f2d4224` (`v6.10.0: Parallel Pre-Check Batch`)
  - `5269a9a` (`v6.11.0: Architect Prompt Hardening`)

## Required Local Invariants

- Keep local `reasoningEffort` override behavior in config and agent mapping.
- Keep canonical `/swarm-*` command guardrails and canonical description map behavior.

## Current Verification Snapshot

- Baseline suites pass:
  - `tests/unit/config/schema.test.ts`
  - `tests/unit/agents/factory.test.ts`
  - `tests/unit/commands/registry.test.ts`
- Failing suites (triage target):
  - `tests/unit/tools/pre-check-batch.test.ts`
  - `tests/unit/tools/syntax-check.test.ts`

## Root Causes Identified

1. `src/tools/pre-check-batch.ts`
   - `validateDirectory()` and `validatePath()` reject valid temp directories on macOS due to path canonicalization mismatch (`/var` vs `/private/var`).
   - This causes early return with `path traversal detected`, so downstream tool logic never executes in tests.

2. `src/tools/syntax-check.ts`
   - Early `isSupportedFile()` filtering removes files before binary/unsupported-language branches run.
   - Parser lookup occurs before file read/binary checks, so several expected skip/error outcomes are never emitted.

## Stage 3 Resolution Plan (Ordered)

1. Fix `src/tools/pre-check-batch.ts`
   - Canonicalize base/target paths (realpath-aware) before traversal checks.
   - Preserve existing traversal protection while allowing valid in-repo/tmp paths.

2. Fix `src/tools/syntax-check.ts`
   - Remove early extension-only filtering.
   - Reorder per-file flow to: read file -> size/binary checks -> parser lookup -> parse.
   - Preserve existing evidence output shape.

3. Rebuild generated outputs
   - Run build to regenerate `dist/**` from source, avoid manual dist conflict handling.

4. Retest
   - Required: `tests/unit/tools/pre-check-batch.test.ts` and `tests/unit/tools/syntax-check.test.ts`.
   - Regression: `tests/unit/config/schema.test.ts`, `tests/unit/agents/factory.test.ts`, `tests/unit/commands/registry.test.ts`.

## Keep/Ours/Hybrid Decisions

- `src/config/schema.ts`: hybrid, preserve local `reasoningEffort` + keep upstream pipeline additions.
- `src/index.ts`: keep local canonical command behavior; retain upstream tool registrations.
- `src/hooks/system-enhancer.ts`: keep upstream parallel pre-check hints.
- `src/tools/pre-check-batch.ts`: hybrid fix.
- `src/tools/syntax-check.ts`: hybrid fix.
