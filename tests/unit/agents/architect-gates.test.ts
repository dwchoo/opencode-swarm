import { describe, expect, test } from 'bun:test';
import { createArchitectAgent } from '../../../src/agents/architect';

/**
 * QA GATE TESTS: sast_scan Integration (Task 3.4)
 * 
 * Tests for sast_scan gate in the QA sequence:
 * - Gate ordering (sast_scan after secretscan, before reviewer)
 * - Error handling (SAST FINDINGS AT OR ABOVE THRESHOLD return to coder)
 * - Success path (NO FINDINGS proceeds to reviewer)
 * - Non-skippable gate
 */

describe('ARCHITECT QA GATE: sast_scan Integration', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('sast_scan is in MANDATORY QA GATE sequence (Rule 7)', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		expect(qaGate).toContain('secretscan');
		expect(qaGate).toContain('sast_scan');
		expect(qaGate).toContain('reviewer');
		
		// Verify ordering: secretscan → sast_scan → reviewer
		const secretscanPos = qaGate.indexOf('secretscan');
		const sastPos = qaGate.indexOf('sast_scan');
		const reviewerPos = qaGate.indexOf('reviewer');
		
		expect(secretscanPos).toBeLessThan(sastPos);
		expect(sastPos).toBeLessThan(reviewerPos);
	});

	test('sast_scan has explicit branching language with severity threshold (SAST FINDINGS AT OR ABOVE THRESHOLD vs NO FINDINGS)', () => {
		// Must have SAST FINDINGS AT OR ABOVE THRESHOLD branch
		expect(prompt).toContain('SAST FINDINGS AT OR ABOVE THRESHOLD');
		expect(prompt).toContain('return to coder');
		
		// Must have NO FINDINGS branch
		expect(prompt).toContain('NO FINDINGS');
		expect(prompt).toContain('proceed to reviewer');
	});

	test('sast_scan runs AFTER secretscan in Phase 5', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const secretscanPos = phase5Section.indexOf('5h.');
		const sastPos = phase5Section.indexOf('5i.');
		
		expect(secretscanPos).toBeLessThan(sastPos);
		expect(phase5Section).toContain('sast_scan');
	});

	test('sast_scan runs BEFORE reviewer in Phase 5', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const sastPos = phase5Section.indexOf('5i.');
		const reviewerPos = phase5Section.indexOf('5j.');
		
		expect(sastPos).toBeLessThan(reviewerPos);
		expect(phase5Section).toContain('reviewer');
	});

	test('sast_scan findings AT OR ABOVE THRESHOLD triggers coder retry', () => {
		// In Phase 5i
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const sastStep = phase5Section.substring(
			phase5Section.indexOf('5i.'),
			phase5Section.indexOf('5j.')
		);
		
		expect(sastStep).toContain('SAST FINDINGS AT OR ABOVE THRESHOLD');
		expect(sastStep).toContain('return to coder');
	});

	test('sast_scan clean proceeds to build_check (then to reviewer)', () => {
		// In Phase 5i
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const sastStep = phase5Section.substring(
			phase5Section.indexOf('5i.'),
			phase5Section.indexOf('5j.')
		);
		
		expect(sastStep).toContain('NO FINDINGS');
		expect(sastStep).toContain('proceed to build_check');
	});

	test('sast_scan cannot be skipped in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// sast_scan is mandatory, not optional
		expect(qaGate.toLowerCase()).not.toContain('optional');
		expect(qaGate.toLowerCase()).not.toContain('skip');
		
		// Must run after secretscan
		const secretscanPos = qaGate.indexOf('secretscan');
		const sastPos = qaGate.indexOf('sast_scan');
		expect(sastPos).toBeGreaterThan(secretscanPos);
		
		// Must run before reviewer
		const reviewerPos = qaGate.indexOf('reviewer');
		expect(reviewerPos).toBeGreaterThan(sastPos);
	});

	test('sast_scan triggers security gate (alongside secretscan)', () => {
		// Security gate should trigger on sast_scan findings
		const securityGate = prompt.match(/Security gate:[^`]*/)?.[0] || '';
		expect(securityGate).toContain('sast_scan');
		expect(securityGate).toContain('ANY findings at or above threshold');
	});

	test('sast_scan runs AFTER lint in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		const lintPos = qaGate.indexOf('lint');
		const sastPos = qaGate.indexOf('sast_scan');
		
		expect(lintPos).toBeLessThan(sastPos);
	});

	test('sast_scan is ordered before test_engineer in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		const sastPos = qaGate.indexOf('sast_scan');
		const testPos = qaGate.indexOf('verification tests');
		
		expect(testPos).toBeGreaterThan(sastPos);
	});
});

describe('ARCHITECT QA GATE: sast_scan Tool Reference', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('Available Tools includes sast_scan', () => {
		const toolsSection = prompt.match(/Available Tools:[^`]*$/m)?.[0] || '';
		expect(toolsSection).toContain('sast_scan');
	});

	test('sast_scan description includes static analysis', () => {
		const toolsSection = prompt.match(/Available Tools:[^`]*$/m)?.[0] || '';
		// Should mention it's a static analysis security scan
		expect(toolsSection).toContain('static analysis security scan');
	});
});

describe('ARCHITECT QA GATE: sast_scan Anti-Bypass', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('sast_scan is mandatory (not skippable)', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// Must appear in the sequence
		expect(qaGate).toContain('sast_scan');
		
		// Cannot be skipped
		expect(qaGate.toLowerCase()).not.toMatch(/sast_scan.*skip/);
		expect(qaGate.toLowerCase()).not.toMatch(/optional.*sast_scan/);
	});

	test('sast_scan ordering cannot be bypassed by reviewer coming earlier', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// Get positions
		const secretscanPos = qaGate.indexOf('secretscan');
		const sastPos = qaGate.indexOf('sast_scan');
		const reviewerPos = qaGate.indexOf('reviewer');
		
		// sast_scan MUST be between secretscan and reviewer
		expect(secretscanPos).toBeLessThan(sastPos);
		expect(sastPos).toBeLessThan(reviewerPos);
	});

	test('secretscan proceeds to sast_scan (not directly to reviewer)', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		// 5h is secretscan
		const secretscanStep = phase5Section.substring(
			phase5Section.indexOf('5h.'),
			phase5Section.indexOf('5i.')
		);
		
		// secretscan should proceed to sast_scan, not to reviewer
		expect(secretscanStep).toContain('proceed to sast_scan');
		expect(secretscanStep).not.toContain('proceed to reviewer');
	});

	test('sast_scan gating is distinct from secretscan gating', () => {
		// sast_scan has threshold-based findings, secretscan has any findings
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		// secretscan step (5h)
		const secretscanStep = phase5Section.substring(
			phase5Section.indexOf('5h.'),
			phase5Section.indexOf('5i.')
		);
		
		// sast_scan step (5i)
		const sastStep = phase5Section.substring(
			phase5Section.indexOf('5i.'),
			phase5Section.indexOf('5j.')
		);
		
		// secretscan: FINDINGS → return to coder (any findings)
		expect(secretscanStep).toContain('FINDINGS');
		
		// sast_scan: SAST FINDINGS AT OR ABOVE THRESHOLD → return to coder
		expect(sastStep).toContain('SAST FINDINGS AT OR ABOVE THRESHOLD');
		
		// Both have NO FINDINGS proceeding
		expect(secretscanStep).toContain('NO FINDINGS');
		expect(sastStep).toContain('NO FINDINGS');
	});
});

describe('ARCHITECT QA GATE: build_check Integration', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('build_check is in MANDATORY QA GATE sequence (Rule 7)', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		expect(qaGate).toContain('sast_scan');
		expect(qaGate).toContain('build_check');
		expect(qaGate).toContain('reviewer');
		
		// Verify ordering: sast_scan → build_check → reviewer
		const sastPos = qaGate.indexOf('sast_scan');
		const buildPos = qaGate.indexOf('build_check');
		const reviewerPos = qaGate.indexOf('reviewer');
		
		expect(sastPos).toBeLessThan(buildPos);
		expect(buildPos).toBeLessThan(reviewerPos);
	});

	test('build_check has explicit branching language with three paths', () => {
		// Must have BUILD FAILURES branch
		expect(prompt).toContain('BUILD FAILURES');
		expect(prompt).toContain('return to coder');
		
		// Must have SKIPPED (no toolchain) branch
		expect(prompt).toContain('SKIPPED (no toolchain)');
		expect(prompt).toContain('proceed');
		
		// Must have PASSED branch
		expect(prompt).toContain('PASSED');
		expect(prompt).toContain('proceed to reviewer');
	});

	test('build_check runs AFTER sast_scan in Phase 5', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const sastPos = phase5Section.indexOf('5i.');
		const buildPos = phase5Section.indexOf('5j.');
		
		expect(sastPos).toBeLessThan(buildPos);
		expect(phase5Section).toContain('build_check');
	});

	test('build_check runs BEFORE reviewer in Phase 5', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const buildPos = phase5Section.indexOf('5j.');
		const reviewerPos = phase5Section.indexOf('5k.');
		
		expect(buildPos).toBeLessThan(reviewerPos);
		expect(phase5Section).toContain('reviewer');
	});

	test('build_check failures triggers coder retry', () => {
		// In Phase 5j
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const buildStep = phase5Section.substring(
			phase5Section.indexOf('5j.'),
			phase5Section.indexOf('5k.')
		);
		
		expect(buildStep).toContain('BUILD FAILURES');
		expect(buildStep).toContain('return to coder');
	});

	test('build_check skipped (no toolchain) proceeds to reviewer', () => {
		// In Phase 5j
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const buildStep = phase5Section.substring(
			phase5Section.indexOf('5j.'),
			phase5Section.indexOf('5k.')
		);
		
		expect(buildStep).toContain('SKIPPED (no toolchain)');
		expect(buildStep).toContain('proceed');
	});

	test('build_check passed proceeds to quality_budget', () => {
		// In Phase 5j
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const buildStep = phase5Section.substring(
			phase5Section.indexOf('5j.'),
			phase5Section.indexOf('5k.')
		);
		
		expect(buildStep).toContain('PASSED');
		expect(buildStep).toContain('proceed to quality_budget');
	});

	test('build_check cannot be skipped in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// build_check is mandatory in sequence
		expect(qaGate).toContain('build_check');
		
		// Must run after sast_scan
		const sastPos = qaGate.indexOf('sast_scan');
		const buildPos = qaGate.indexOf('build_check');
		expect(buildPos).toBeGreaterThan(sastPos);
		
		// Must run before reviewer
		const reviewerPos = qaGate.indexOf('reviewer');
		expect(reviewerPos).toBeGreaterThan(buildPos);
	});

	test('build_check runs BEFORE test_engineer in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		const buildPos = qaGate.indexOf('build_check');
		const testPos = qaGate.indexOf('verification tests');
		
		expect(testPos).toBeGreaterThan(buildPos);
	});
});

describe('ARCHITECT QA GATE: build_check Tool Reference', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('Available Tools includes build_check', () => {
		const toolsSection = prompt.match(/Available Tools:[^`]*$/m)?.[0] || '';
		expect(toolsSection).toContain('build_check');
	});

	test('build_check description includes build verification', () => {
		const toolsSection = prompt.match(/Available Tools:[^`]*$/m)?.[0] || '';
		// Should mention it's for build verification
		expect(toolsSection).toContain('build');
	});
});

describe('ARCHITECT QA GATE: build_check Anti-Bypass', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('build_check is mandatory (not skippable)', () => {
		// Check in Rule 7 sequence
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// Must appear in the sequence
		expect(qaGate).toContain('build_check');
		
		// Check detailed branching in Phase 5
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const buildStep = phase5Section.substring(
			phase5Section.indexOf('5j.'),
			phase5Section.indexOf('5k.')
		);
		
		// Cannot be bypassed - must have three distinct paths
		expect(buildStep).toContain('BUILD FAILURES');
		expect(buildStep).toContain('SKIPPED (no toolchain)');
		expect(buildStep).toContain('PASSED');
	});

	test('build_check ordering cannot be bypassed by reviewer coming earlier', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// Get positions
		const sastPos = qaGate.indexOf('sast_scan');
		const buildPos = qaGate.indexOf('build_check');
		const reviewerPos = qaGate.indexOf('reviewer');
		
		// build_check MUST be between sast_scan and reviewer
		expect(sastPos).toBeLessThan(buildPos);
		expect(buildPos).toBeLessThan(reviewerPos);
	});

	test('sast_scan proceeds to build_check (not directly to reviewer)', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		// 5i is sast_scan
		const sastStep = phase5Section.substring(
			phase5Section.indexOf('5i.'),
			phase5Section.indexOf('5j.')
		);
		
		// sast_scan should proceed to build_check, not to reviewer
		expect(sastStep).toContain('proceed to build_check');
		expect(sastStep).not.toContain('proceed to reviewer');
	});

	test('build_check gating has three distinct paths', () => {
		// build_check has three paths: failures, skipped, passed
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		// build_check step (5j)
		const buildStep = phase5Section.substring(
			phase5Section.indexOf('5j.'),
			phase5Section.indexOf('5k.')
		);
		
		// BUILD FAILURES → return to coder
		expect(buildStep).toContain('BUILD FAILURES');
		
		// SKIPPED (no toolchain) → proceed
		expect(buildStep).toContain('SKIPPED (no toolchain)');
		
		// PASSED → proceed to quality_budget (not directly to reviewer)
		expect(buildStep).toContain('PASSED');
		expect(buildStep).toContain('proceed to quality_budget');
	});

	test('build_check is distinct from sast_scan gating', () => {
		// build_check has different failure modes than sast_scan
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		// sast_scan step (5i)
		const sastStep = phase5Section.substring(
			phase5Section.indexOf('5i.'),
			phase5Section.indexOf('5j.')
		);
		
		// build_check step (5j)
		const buildStep = phase5Section.substring(
			phase5Section.indexOf('5j.'),
			phase5Section.indexOf('5k.')
		);
		
		// sast_scan: SAST FINDINGS AT OR ABOVE THRESHOLD → return to coder
		expect(sastStep).toContain('SAST FINDINGS AT OR ABOVE THRESHOLD');
		
		// build_check: BUILD FAILURES → return to coder
		expect(buildStep).toContain('BUILD FAILURES');
		
		// build_check has skipped path that sast_scan doesn't have
		expect(buildStep).toContain('SKIPPED (no toolchain)');
	});
});

/**
 * QA GATE TESTS: placeholder_scan Integration (Task 2.3)
 * 
 * Tests for placeholder_scan gate in the QA sequence:
 * - Gate ordering (placeholder_scan after syntax_check, before imports)
 * - Error handling (placeholder findings return to coder)
 * - Success path (clean scan proceeds to imports)
 */

describe('ARCHITECT QA GATE: placeholder_scan Integration', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('placeholder_scan is in MANDATORY QA GATE sequence (Rule 7)', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		expect(qaGate).toContain('placeholder_scan');
		expect(qaGate).toContain('syntax_check');
		expect(qaGate).toContain('imports');
		
		// Verify ordering: syntax_check → placeholder_scan → imports
		const syntaxPos = qaGate.indexOf('syntax_check');
		const placeholderPos = qaGate.indexOf('placeholder_scan');
		const importsPos = qaGate.indexOf('imports');
		
		expect(syntaxPos).toBeLessThan(placeholderPos);
		expect(placeholderPos).toBeLessThan(importsPos);
	});

	test('placeholder_scan has explicit branching language (PLACEHOLDER FINDINGS vs NO FINDINGS)', () => {
		// Must have PLACEHOLDER FINDINGS branch
		expect(prompt).toContain('PLACEHOLDER FINDINGS');
		expect(prompt).toContain('return to coder');
		
		// Must have NO FINDINGS branch
		expect(prompt).toContain('NO FINDINGS');
		expect(prompt).toContain('proceed to imports');
	});

	test('placeholder_scan runs AFTER syntax_check in Phase 5', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const syntaxPos = phase5Section.indexOf('5d.');
		const placeholderPos = phase5Section.indexOf('5e.');
		
		expect(syntaxPos).toBeLessThan(placeholderPos);
		expect(phase5Section).toContain('placeholder_scan');
	});

	test('placeholder_scan runs BEFORE imports in Phase 5', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const placeholderPos = phase5Section.indexOf('5e.');
		const importsPos = phase5Section.indexOf('5f.');
		
		expect(placeholderPos).toBeLessThan(importsPos);
		expect(phase5Section).toContain('imports');
	});

	test('placeholder_scan findings triggers coder retry', () => {
		// In Phase 5e
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const placeholderStep = phase5Section.substring(
			phase5Section.indexOf('5e.'),
			phase5Section.indexOf('5f.')
		);
		
		expect(placeholderStep).toContain('PLACEHOLDER FINDINGS');
		expect(placeholderStep).toContain('return to coder');
	});

	test('placeholder_scan clean proceeds to imports', () => {
		// In Phase 5e
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const placeholderStep = phase5Section.substring(
			phase5Section.indexOf('5e.'),
			phase5Section.indexOf('5f.')
		);
		
		expect(placeholderStep).toContain('NO FINDINGS');
		expect(placeholderStep).toContain('proceed to imports');
	});

	test('placeholder_scan cannot be skipped in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// placeholder_scan is mandatory, not optional
		expect(qaGate.toLowerCase()).not.toContain('optional');
		expect(qaGate.toLowerCase()).not.toContain('skip');
		
		// Must run after syntax_check
		const syntaxPos = qaGate.indexOf('syntax_check');
		const placeholderPos = qaGate.indexOf('placeholder_scan');
		expect(placeholderPos).toBeGreaterThan(syntaxPos);
		
		// Must run before secretscan
		const secretscanPos = qaGate.indexOf('secretscan');
		expect(secretscanPos).toBeGreaterThan(placeholderPos);
	});

	test('placeholder_scan runs BEFORE reviewer in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		const placeholderPos = qaGate.indexOf('placeholder_scan');
		const reviewerPos = qaGate.indexOf('reviewer');
		
		expect(reviewerPos).toBeGreaterThan(placeholderPos);
	});
});

describe('ARCHITECT QA GATE: placeholder_scan Tool Reference', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('Available Tools includes placeholder_scan', () => {
		const toolsSection = prompt.match(/Available Tools:[^`]*$/m)?.[0] || '';
		expect(toolsSection).toContain('placeholder_scan');
	});
});

describe('ARCHITECT QA GATE: syntax_check Integration', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('syntax_check is in MANDATORY QA GATE sequence (Rule 7)', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		expect(qaGate).toContain('syntax_check');
		expect(qaGate).toContain('diff');
		expect(qaGate).toContain('imports');
		
		// Verify ordering: diff → syntax_check → imports
		const diffPos = qaGate.indexOf('diff');
		const syntaxPos = qaGate.indexOf('syntax_check');
		const importsPos = qaGate.indexOf('imports');
		
		expect(diffPos).toBeLessThan(syntaxPos);
		expect(syntaxPos).toBeLessThan(importsPos);
	});

	test('syntax_check has explicit branching language (SYNTACTIC ERRORS vs NO ERRORS)', () => {
		// Must have SYNTACTIC ERRORS branch
		expect(prompt).toContain('SYNTACTIC ERRORS');
		expect(prompt).toContain('return to coder');
		
		// Must have NO ERRORS branch
		expect(prompt).toContain('NO ERRORS');
		expect(prompt).toContain('proceed to imports');
	});

	test('syntax_check runs AFTER diff in Phase 5', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const diffPos = phase5Section.indexOf('5c.');
		const syntaxPos = phase5Section.indexOf('5d.');
		
		expect(diffPos).toBeLessThan(syntaxPos);
		expect(phase5Section).toContain('syntax_check');
	});

	test('syntax_check runs BEFORE imports in Phase 5', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const syntaxPos = phase5Section.indexOf('5d.');
		const importsPos = phase5Section.indexOf('5e.');
		
		expect(syntaxPos).toBeLessThan(importsPos);
		expect(phase5Section).toContain('imports');
	});

	test('syntax_check error triggers coder retry', () => {
		// In Phase 5d
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const syntaxStep = phase5Section.substring(
			phase5Section.indexOf('5d.'),
			phase5Section.indexOf('5e.')
		);
		
		expect(syntaxStep).toContain('SYNTACTIC ERRORS');
		expect(syntaxStep).toContain('return to coder');
	});

	test('syntax_check clean proceeds to placeholder_scan', () => {
		// In Phase 5d
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const syntaxStep = phase5Section.substring(
			phase5Section.indexOf('5d.'),
			phase5Section.indexOf('5e.')
		);
		
		expect(syntaxStep).toContain('NO ERRORS');
		expect(syntaxStep).toContain('proceed to placeholder_scan');
	});

	test('syntax_check cannot be skipped in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// syntax_check is mandatory, not optional
		expect(qaGate.toLowerCase()).not.toContain('optional');
		expect(qaGate.toLowerCase()).not.toContain('skip');
		
		// Must run before secretscan
		const syntaxPos = qaGate.indexOf('syntax_check');
		const secretscanPos = qaGate.indexOf('secretscan');
		expect(secretscanPos).toBeGreaterThan(syntaxPos);
	});

	test('syntax_check runs BEFORE reviewer in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		const syntaxPos = qaGate.indexOf('syntax_check');
		const reviewerPos = qaGate.indexOf('reviewer');
		
		expect(reviewerPos).toBeGreaterThan(syntaxPos);
	});
});

describe('ARCHITECT QA GATE: syntax_check Tool Reference', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('Available Tools includes syntax_check', () => {
		const toolsSection = prompt.match(/Available Tools:[^`]*$/m)?.[0] || '';
		expect(toolsSection).toContain('syntax_check');
	});

	test('syntax_check is not in SECURITY_KEYWORDS (it is a pre-review gate)', () => {
		// syntax_check is a gate, not a security trigger
		const securityKeywordsMatch = prompt.match(/SECURITY_KEYWORDS:[^`]*$/m)?.[0] || '';
		// Note: syntax_check should NOT be in SECURITY_KEYWORDS
		// It's checked separately as a gate, not as a security-triggering keyword
	});
});

/**
 * QA GATE TESTS: quality_budget Integration (Task 6.4)
 * 
 * Tests for quality_budget gate in the QA sequence:
 * - Gate ordering (quality_budget after build_check, before reviewer)
 * - Error handling (QUALITY VIOLATIONS return to coder)
 * - Success path (WITHIN BUDGET proceeds to reviewer)
 */

describe('ARCHITECT QA GATE: quality_budget Integration', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('quality_budget is in MANDATORY QA GATE sequence (Rule 7)', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		expect(qaGate).toContain('build_check');
		expect(qaGate).toContain('quality_budget');
		expect(qaGate).toContain('reviewer');
		
		// Verify ordering: build_check → quality_budget → reviewer
		const buildPos = qaGate.indexOf('build_check');
		const qualityPos = qaGate.indexOf('quality_budget');
		const reviewerPos = qaGate.indexOf('reviewer');
		
		expect(buildPos).toBeLessThan(qualityPos);
		expect(qualityPos).toBeLessThan(reviewerPos);
	});

	test('quality_budget has explicit branching language (QUALITY VIOLATIONS vs WITHIN BUDGET)', () => {
		// Must have QUALITY VIOLATIONS branch
		expect(prompt).toContain('QUALITY VIOLATIONS');
		expect(prompt).toContain('return to coder');
		
		// Must have WITHIN BUDGET branch
		expect(prompt).toContain('WITHIN BUDGET');
		expect(prompt).toContain('proceed to reviewer');
	});

	test('quality_budget runs AFTER build_check in Phase 5', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const buildPos = phase5Section.indexOf('5j.');
		const qualityPos = phase5Section.indexOf('5k.');
		
		expect(buildPos).toBeLessThan(qualityPos);
		expect(phase5Section).toContain('quality_budget');
	});

	test('quality_budget runs BEFORE reviewer in Phase 5', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const qualityPos = phase5Section.indexOf('5k.');
		const reviewerPos = phase5Section.indexOf('5l.');
		
		expect(qualityPos).toBeLessThan(reviewerPos);
		expect(phase5Section).toContain('reviewer');
	});

	test('quality_budget violations triggers coder retry', () => {
		// In Phase 5k
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const qualityStep = phase5Section.substring(
			phase5Section.indexOf('5k.'),
			phase5Section.indexOf('5l.')
		);
		
		expect(qualityStep).toContain('QUALITY VIOLATIONS');
		expect(qualityStep).toContain('return to coder');
	});

	test('quality_budget within budget proceeds to reviewer', () => {
		// In Phase 5k
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const qualityStep = phase5Section.substring(
			phase5Section.indexOf('5k.'),
			phase5Section.indexOf('5l.')
		);
		
		expect(qualityStep).toContain('WITHIN BUDGET');
		expect(qualityStep).toContain('proceed to reviewer');
	});

	test('quality_budget cannot be skipped in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// quality_budget is mandatory, not optional
		expect(qaGate.toLowerCase()).not.toContain('optional');
		expect(qaGate.toLowerCase()).not.toContain('skip');
		
		// Must run after build_check
		const buildPos = qaGate.indexOf('build_check');
		const qualityPos = qaGate.indexOf('quality_budget');
		expect(qualityPos).toBeGreaterThan(buildPos);
		
		// Must run before reviewer
		const reviewerPos = qaGate.indexOf('reviewer');
		expect(reviewerPos).toBeGreaterThan(qualityPos);
	});

	test('quality_budget runs BEFORE test_engineer in QA sequence', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		const qualityPos = qaGate.indexOf('quality_budget');
		const testPos = qaGate.indexOf('verification tests');
		
		expect(testPos).toBeGreaterThan(qualityPos);
	});
});

describe('ARCHITECT QA GATE: quality_budget Tool Reference', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('Available Tools includes quality_budget', () => {
		const toolsSection = prompt.match(/Available Tools:[^`]*$/m)?.[0] || '';
		expect(toolsSection).toContain('quality_budget');
	});
});

describe('ARCHITECT QA GATE: quality_budget Anti-Bypass', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('quality_budget is mandatory (not skippable)', () => {
		// Check in Rule 7 sequence
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// Must appear in the sequence
		expect(qaGate).toContain('quality_budget');
		
		// Check detailed branching in Phase 5
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		const qualityStep = phase5Section.substring(
			phase5Section.indexOf('5k.'),
			phase5Section.indexOf('5l.')
		);
		
		// Cannot be bypassed - must have two distinct paths
		expect(qualityStep).toContain('QUALITY VIOLATIONS');
		expect(qualityStep).toContain('WITHIN BUDGET');
	});

	test('quality_budget ordering cannot be bypassed by reviewer coming earlier', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		// Get positions
		const buildPos = qaGate.indexOf('build_check');
		const qualityPos = qaGate.indexOf('quality_budget');
		const reviewerPos = qaGate.indexOf('reviewer');
		
		// quality_budget MUST be between build_check and reviewer
		expect(buildPos).toBeLessThan(qualityPos);
		expect(qualityPos).toBeLessThan(reviewerPos);
	});

	test('build_check proceeds to quality_budget (not directly to reviewer)', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		// 5j is build_check
		const buildStep = phase5Section.substring(
			phase5Section.indexOf('5j.'),
			phase5Section.indexOf('5k.')
		);
		
		// build_check should proceed to quality_budget, not to reviewer
		expect(buildStep).toContain('proceed to quality_budget');
		expect(buildStep).not.toContain('proceed to reviewer');
	});

	test('quality_budget gating is distinct from build_check gating', () => {
		// quality_budget has different conditions than build_check
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		// build_check step (5j)
		const buildStep = phase5Section.substring(
			phase5Section.indexOf('5j.'),
			phase5Section.indexOf('5k.')
		);
		
		// quality_budget step (5k)
		const qualityStep = phase5Section.substring(
			phase5Section.indexOf('5k.'),
			phase5Section.indexOf('5l.')
		);
		
		// build_check: BUILD FAILURES → return to coder (three paths)
		expect(buildStep).toContain('BUILD FAILURES');
		expect(buildStep).toContain('SKIPPED (no toolchain)');
		expect(buildStep).toContain('PASSED');
		
		// quality_budget: QUALITY VIOLATIONS vs WITHIN BUDGET (two paths)
		expect(qualityStep).toContain('QUALITY VIOLATIONS');
		expect(qualityStep).toContain('WITHIN BUDGET');
	});
});

describe('ARCHITECT QA GATE: Full Sequence Verification', () => {
	const prompt = createArchitectAgent('test-model').config.prompt;

	test('Phase 5 maintains correct step ordering', () => {
		const phase5Section = prompt.substring(
			prompt.indexOf('### Phase 5:'),
			prompt.indexOf('### Phase 6:')
		);
		
		// Verify each step exists and is ordered correctly
		const step5c = phase5Section.indexOf('5c.');
		const step5d = phase5Section.indexOf('5d.');
		const step5e = phase5Section.indexOf('5e.');
		const step5f = phase5Section.indexOf('5f.');
		const step5g = phase5Section.indexOf('5g.');
		const step5h = phase5Section.indexOf('5h.');
		const step5i = phase5Section.indexOf('5i.');
		const step5j = phase5Section.indexOf('5j.');
		const step5k = phase5Section.indexOf('5k.');
		const step5l = phase5Section.indexOf('5l.');
		const step5m = phase5Section.indexOf('5m.');
		
		expect(step5c).toBeLessThan(step5d); // diff < syntax_check
		expect(step5d).toBeLessThan(step5e); // syntax_check < placeholder_scan
		expect(step5e).toBeLessThan(step5f); // placeholder_scan < imports
		expect(step5f).toBeLessThan(step5g); // imports < lint
		expect(step5g).toBeLessThan(step5h); // lint < secretscan
		expect(step5h).toBeLessThan(step5i); // secretscan < sast_scan
		expect(step5i).toBeLessThan(step5j); // sast_scan < build_check
		expect(step5j).toBeLessThan(step5k); // build_check < reviewer
		expect(step5k).toBeLessThan(step5l); // reviewer < security
		expect(step5l).toBeLessThan(step5m); // security < verification
	});

	test('Full QA sequence in Rule 7 includes build_check', () => {
		const qaGate = prompt.match(/\*\*MANDATORY QA GATE[^`]*/)?.[0] || '';
		
		expect(qaGate).toContain('coder → diff → syntax_check → placeholder_scan → imports');
		expect(qaGate).toContain('lint');
		expect(qaGate).toContain('secretscan');
		expect(qaGate).toContain('sast_scan');
		expect(qaGate).toContain('build_check');
		expect(qaGate).toContain('reviewer');
		expect(qaGate).toContain('verification tests');
		expect(qaGate).toContain('adversarial tests');
	});
});
