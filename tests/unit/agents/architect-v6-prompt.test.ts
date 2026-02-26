import { describe, expect, it } from 'bun:test';
import { createArchitectAgent } from '../../../src/agents/architect';
import { createCriticAgent } from '../../../src/agents/critic';

describe('Architect Prompt v6.0 QA & Security Gates (Task 3.2)', () => {
	const agent = createArchitectAgent('test-model');
	const prompt = agent.config.prompt!;

	// ============================================
	// TASK 3.2: Pre-reviewer Sequence & Security Gate
	// ============================================

	describe('Task 3.2 - Pre-reviewer Sequence (imports, lint, secretscan before reviewer)', () => {
		it('1. Rule 7 contains pre-reviewer sequence: imports', () => {
			expect(prompt).toContain('imports');
		});

		it('2. Rule 7 contains pre-reviewer sequence: lint fix', () => {
			expect(prompt).toContain('lint fix');
		});

		it('3. Rule 7 contains pre-reviewer sequence: lint check', () => {
			// In v6.10, lint check is inside pre_check_batch
			expect(prompt).toContain('pre_check_batch');
			expect(prompt).toContain('lint:check');
		});

		it('4. Rule 7 contains pre-reviewer sequence: secretscan', () => {
			expect(prompt).toContain('secretscan');
		});

		it('5. Rule 7 contains pre-reviewer sequence: reviewer comes after tools', () => {
			// The sequence should be: ... → secretscan → ... → reviewer
			expect(prompt).toMatch(/secretscan.*reviewer|secretscan.*proceed to reviewer/);
		});

		it('6. Rule 7 mentions gates_passed before reviewer', () => {
			// In v6.10, secretscan is inside pre_check_batch; gates_passed triggers progression
			expect(prompt).toContain('gates_passed === true');
			expect(prompt).toContain('proceed to @reviewer');
		});

		it('7. Available Tools includes imports', () => {
			expect(prompt).toContain('Available Tools:');
			expect(prompt).toContain('imports (dependency audit)');
		});

		it('8. Available Tools includes lint', () => {
			expect(prompt).toContain('lint (code quality)');
		});

		it('9. Available Tools includes secretscan', () => {
			expect(prompt).toContain('secretscan (secret detection)');
		});
	});

	describe('Task 3.2 - Security Gate (security-only re-review)', () => {
		it('10. Security gate exists in Rule 7 with security globs', () => {
			expect(prompt).toContain('security globs');
			expect(prompt).toContain('auth, api, crypto, security, middleware, session, token');
		});

		it('11. Security gate triggers on security keywords in coder output', () => {
			expect(prompt).toContain('content has security keywords');
		});

		it('12. Security gate delegates to reviewer with security-only CHECK', () => {
			expect(prompt).toContain('security-only CHECK');
		});

		it('13. Security-only re-review example exists in DELEGATION FORMAT', () => {
			// Check for the example in the delegation format section
			expect(prompt).toContain('Security-only review');
			expect(prompt).toContain('CHECK: [security-only]');
		});

		it('14. Security-only review mentions OWASP Top 10', () => {
			expect(prompt).toContain('OWASP Top 10');
		});

		it('15. Security gate includes secretscan findings trigger', () => {
			// In Phase 5 workflow: "secretscan has ANY findings"
			expect(prompt).toContain('secretscan has ANY findings');
		});
	});

	describe('Rule 7 - Mandatory QA Gate Summary', () => {
		it('16. Rule 7 contains "MANDATORY QA GATE"', () => {
			expect(prompt).toContain('MANDATORY QA GATE');
		});

		it('17. Rule 7 contains full sequence with tools', () => {
			// The full sequence in v6.10: coder → diff → syntax_check → placeholder_scan → lint fix → build_check → pre_check_batch → reviewer
			expect(prompt).toContain('coder → diff → syntax_check');
			expect(prompt).toContain('placeholder_scan');
			expect(prompt).toContain('lint fix');
			expect(prompt).toContain('pre_check_batch');
			expect(prompt).toContain('reviewer');
		});

		it('18. Rule 7 mentions security review in sequence', () => {
			expect(prompt).toContain('security review');
		});

		it('19. Rule 7 mentions verification tests', () => {
			expect(prompt).toContain('verification tests');
		});

		it('20. Rule 7 mentions adversarial tests', () => {
			expect(prompt).toContain('adversarial tests');
		});

		it('21. Rule 7 mentions integration analysis with hasContractChanges', () => {
			expect(prompt).toContain('hasContractChanges');
			expect(prompt).toContain('integration impact analysis');
		});
	});

	describe('Rule Structure', () => {
		it('22. No Rule 8 exists', () => {
			expect(prompt).not.toContain('8. **NEVER skip the QA gate');
		});
	});

	describe('Phase 5 Workflow - Pre-reviewer Tools', () => {
		it('23. Phase 5 step 5c is diff tool', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5c. Run `diff` tool');
		});

		it('24. Phase 5 step 5d is syntax_check tool', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5d. Run `syntax_check` tool');
		});

		it('25. Phase 5 step 5e is placeholder_scan tool', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5e. Run `placeholder_scan` tool');
		});

		it('26. Phase 5 step 5f is imports tool', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5f. Run `imports` tool');
		});

		it('27. Phase 5 step 5g is lint tool', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5g. Run `lint` tool');
		});

		it('28. Phase 5 step 5h is build_check tool', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5h. Run `build_check` tool');
		});

		it('29. Phase 5 step 5i is pre_check_batch', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5i. Run `pre_check_batch` tool');
			expect(phase5Section).toContain('lint:check');
			expect(phase5Section).toContain('secretscan');
		});
	});

	describe('Phase 5 Workflow - Security Gate', () => {
		it('30. Phase 5 step 5j is general reviewer', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5j. {{AGENT_PREFIX}}reviewer - General review');
		});

		it('31. Phase 5 step 5k is Security gate', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5k. Security gate');
		});

		it('32. Security gate includes security globs trigger', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('file matches security globs');
		});

		it('33. Security gate includes content keywords trigger', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('content has security keywords');
		});

		it('34. Security gate includes secretscan findings trigger', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('secretscan has ANY findings');
		});

		it('35. Security gate delegates to reviewer security-only', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('{{AGENT_PREFIX}}reviewer security-only');
		});
	});

	describe('Phase 5 Workflow - Test Steps', () => {
		it('36. Phase 5 step 5l is verification tests', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5l. {{AGENT_PREFIX}}test_engineer - Verification tests');
		});

		it('37. Phase 5 step 5m is adversarial tests', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5m. {{AGENT_PREFIX}}test_engineer - Adversarial tests');
		});

		it('38. Phase 5 step 5n is COVERAGE CHECK', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5n. COVERAGE CHECK');
		});

		it('39. Phase 5 step 5o is update plan.md', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5o. Update plan.md');
		});

		it('40. Phase 5 has steps 5a through 5o', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5a.');
			expect(phase5Section).toContain('5b.');
			expect(phase5Section).toContain('5c.');
			expect(phase5Section).toContain('5d.');
			expect(phase5Section).toContain('5e.');
			expect(phase5Section).toContain('5f.');
			expect(phase5Section).toContain('5g.');
			expect(phase5Section).toContain('5h.');
			expect(phase5Section).toContain('5i.');
			expect(phase5Section).toContain('5j.');
			expect(phase5Section).toContain('5k.');
			expect(phase5Section).toContain('5l.');
			expect(phase5Section).toContain('5m.');
			expect(phase5Section).toContain('5n.');
			expect(phase5Section).toContain('5o.');
		});
	});

	describe('Phase 5 Workflow - Retry Logic', () => {
		it('41. Reviewer retry logic mentions QA_RETRY_LIMIT', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('QA_RETRY_LIMIT');
			expect(phase5Section).toContain('coder retry');
		});

		it('42. Security gate has retry logic', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('REJECTED (< {{QA_RETRY_LIMIT}}) → coder retry');
		});
	});

	describe('Adversarial Test Example', () => {
		it('43. Adversarial test example exists', () => {
			expect(prompt).toContain('Adversarial security testing');
			expect(prompt).toContain('attack vectors');
		});
	});

	describe('Integration Analysis Example', () => {
		it('44. Integration analysis example exists', () => {
			expect(prompt).toContain('Integration impact analysis');
			expect(prompt).toContain('BREAKING/COMPATIBLE');
		});
	});

	describe('Rule 10 - Retrospective Tracking', () => {
		it('45. Rule 10 contains "RETROSPECTIVE TRACKING"', () => {
			expect(prompt).toContain('RETROSPECTIVE TRACKING');
		});

		it('46. Rule 10 mentions evidence manager', () => {
			expect(prompt).toContain('evidence manager');
		});

		it('47. Rule 10 lists tracked metrics', () => {
			expect(prompt).toContain('phase_number');
			expect(prompt).toContain('coder_revisions');
			expect(prompt).toContain('reviewer_rejections');
			expect(prompt).toContain('test_failures');
			expect(prompt).toContain('security_findings');
			expect(prompt).toContain('lessons_learned');
		});

		it('48. Rule 10 mentions Phase Metrics reset', () => {
			expect(prompt).toContain('Reset Phase Metrics');
		});
	});

	describe('Phase 6 Structure', () => {
		it('49. Phase 6 has retrospective evidence step', () => {
			const phase6Start = prompt.indexOf('### MODE: PHASE-WRAP');
			const blockersStart = prompt.indexOf('### Blockers');
			const phase6Section = prompt.slice(phase6Start, blockersStart);
			expect(phase6Section).toContain('Write retrospective evidence');
			expect(phase6Section).toContain('evidence manager');
		});

		it('50. Phase 6 mentions Reset Phase Metrics', () => {
			const phase6Start = prompt.indexOf('### MODE: PHASE-WRAP');
			const blockersStart = prompt.indexOf('### Blockers');
			const phase6Section = prompt.slice(phase6Start, blockersStart);
			expect(phase6Section).toContain('Reset Phase Metrics');
		});
	});

	describe('Phase 5 pre_check_batch Gate (v6.10)', () => {
		it('pre_check_batch step exists in Phase 5', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('pre_check_batch');
		});

		it('pre_check_batch runs parallel verification with gates_passed', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('gates_passed');
		});

		it('pre_check_batch failure returns to coder (no reviewer)', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('gates_passed === false');
		});

		it('pre_check_batch includes lint:check', () => {
			const precheckStart = prompt.indexOf('pre_check_batch');
			const reviewerPos = prompt.indexOf('{{AGENT_PREFIX}}reviewer', precheckStart);
			const precheckSection = prompt.slice(precheckStart, reviewerPos);
			expect(precheckSection).toContain('lint:check');
		});

		it('pre_check_batch includes secretscan', () => {
			const precheckStart = prompt.indexOf('pre_check_batch');
			const reviewerPos = prompt.indexOf('{{AGENT_PREFIX}}reviewer', precheckStart);
			const precheckSection = prompt.slice(precheckStart, reviewerPos);
			expect(precheckSection).toContain('secretscan');
		});

		it('pre_check_batch includes sast_scan', () => {
			const precheckStart = prompt.indexOf('pre_check_batch');
			const reviewerPos = prompt.indexOf('{{AGENT_PREFIX}}reviewer', precheckStart);
			const precheckSection = prompt.slice(precheckStart, reviewerPos);
			expect(precheckSection).toContain('sast_scan');
		});

		it('pre_check_batch includes quality_budget', () => {
			const precheckStart = prompt.indexOf('pre_check_batch');
			const reviewerPos = prompt.indexOf('{{AGENT_PREFIX}}reviewer', precheckStart);
			const precheckSection = prompt.slice(precheckStart, reviewerPos);
			expect(precheckSection).toContain('quality_budget');
		});

		it('pre_check_batch runs BEFORE reviewer', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			const precheckPos = phase5Section.indexOf('pre_check_batch');
			const reviewerPos = phase5Section.indexOf('{{AGENT_PREFIX}}reviewer');
			expect(precheckPos).toBeLessThan(reviewerPos);
		});
	});

	describe('Phase 5 build_check Gate (v6.10)', () => {
		it('build_check step exists in Phase 5 at step 5h', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('5h. Run `build_check` tool');
		});

		it('build_check failure returns to coder', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('BUILD FAILS');
			expect(phase5Section).toContain('return to coder');
		});

		it('build_check success proceeds to pre_check_batch', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('proceed to pre_check_batch');
		});

		it('build_check runs BEFORE pre_check_batch', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			const buildPos = phase5Section.indexOf('build_check');
			const precheckPos = phase5Section.indexOf('pre_check_batch');
			expect(buildPos).toBeLessThan(precheckPos);
		});
	});

	describe('Phase 5 New Tool Gates (v6.10)', () => {
		it('syntax_check step exists at 5d and runs before placeholder_scan', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			const syntaxPos = phase5Section.indexOf('5d. Run `syntax_check`');
			const placeholderPos = phase5Section.indexOf('5e. Run `placeholder_scan`');
			expect(syntaxPos).toBeGreaterThan(-1);
			expect(placeholderPos).toBeGreaterThan(-1);
			expect(syntaxPos).toBeLessThan(placeholderPos);
		});

		it('placeholder_scan runs before imports', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			const placeholderPos = phase5Section.indexOf('placeholder_scan');
			const importsPos = phase5Section.indexOf('5f. Run `imports`');
			expect(placeholderPos).toBeLessThan(importsPos);
		});

		it('syntax_check errors return to coder', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('SYNTACTIC ERRORS');
			expect(phase5Section).toContain('return to coder');
		});

		it('placeholder_scan findings return to coder', () => {
			const phase5Section = prompt.slice(
				prompt.indexOf('### MODE: EXECUTE'),
				prompt.indexOf('### MODE: PHASE-WRAP')
			);
			expect(phase5Section).toContain('PLACEHOLDER FINDINGS');
			expect(phase5Section).toContain('return to coder');
		});
	});

	// ============================================
	// Phase 4: TASK GRANULARITY RULES (v6.11)
	// ============================================

	describe('Architect Prompt Hardening v6.11 - Task Granularity (Phase 4)', () => {
		it('TASK GRANULARITY RULES exists in MODE: PLAN', () => {
			expect(prompt).toContain('TASK GRANULARITY RULES');
		});

		it('SMALL task definition exists', () => {
			expect(prompt).toContain('SMALL task');
			expect(prompt).toContain('1 file');
		});

		it('MEDIUM task definition exists', () => {
			expect(prompt).toContain('MEDIUM task');
		});

		it('Large task definition exists', () => {
			expect(prompt).toContain('LARGE task');
		});

		it('coder receives one task rule exists', () => {
			expect(prompt).toContain('Coder receives ONE task');
		});

		it('Litmus test for task size exists', () => {
			expect(prompt).toContain('Litmus test');
			expect(prompt).toContain('3 bullet points');
		});
	});
});

// ============================================
// Critic Prompt - Task Atomicity (Phase 4)
// ============================================

describe('Critic Prompt - Task Atomicity (Phase 4)', () => {
	const agent = createCriticAgent('test-model');
	const prompt = agent.config.prompt!;

	it('Task Atomicity exists in REVIEW CHECKLIST', () => {
		expect(prompt).toContain('Task Atomicity');
		expect(prompt).toContain('REVIEW CHECKLIST');
	});

	it('checks for multi-file tasks (2+ files)', () => {
		expect(prompt).toContain('2+ files');
	});

	it('checks for compound verbs in task descriptions', () => {
		expect(prompt).toContain('compound verbs');
	});

	it('flags oversized tasks as MAJOR issue', () => {
		expect(prompt).toContain('oversized tasks');
		expect(prompt).toContain('MAJOR');
	});

	it('suggests splitting into sequential single-file tasks', () => {
		expect(prompt).toContain('Split into sequential');
		expect(prompt).toContain('single-file');
	});

	it('mentions coder context blow risk', () => {
		expect(prompt).toContain("blow coder's context");
	});
});

// ============================================
// Phase 6: FAILURE COUNTING and RETRY PROTOCOL (v6.11)
// ============================================

describe('Architect Prompt Hardening v6.11 - Phase 6 (Failure Counting & Retry)', () => {
	const agent = createArchitectAgent('test-model');
	const prompt = agent.config.prompt!;

	it('FAILURE COUNTING exists in Rule 4', () => {
		expect(prompt).toContain('FAILURE COUNTING');
	});

	it('Failure counter increments on tool gate failure', () => {
		expect(prompt).toContain('gates_passed === false');
	});

	it('Failure counter increments on reviewer rejection', () => {
		expect(prompt).toContain('REJECTED by reviewer');
	});

	it('Retry message format exists', () => {
		expect(prompt).toContain('Coder attempt [N/{{QA_RETRY_LIMIT}}] on task');
	});

	it('RETRY PROTOCOL exists before step 5a', () => {
		expect(prompt).toContain('RETRY PROTOCOL');
	});

	it('Structured rejection format specified', () => {
		expect(prompt).toContain('GATE FAILED');
		expect(prompt).toContain('REQUIRED FIX');
	});

	it('Re-entry point at step 5b specified', () => {
		expect(prompt).toContain('Re-enter at step 5b');
	});

	it('Resume at failed step (not beginning) specified', () => {
		expect(prompt).toContain('Resume execution at the failed step');
	});
});

// ============================================
// Phase 2-7: CONSOLIDATED HARDENING v6.11
// ============================================

describe('Architect Prompt Hardening v6.11 - Consolidated', () => {
	const agent = createArchitectAgent('test-model');
	const prompt = agent.config.prompt!;

	// Phase 2 - Namespace
	describe('NAMESPACE RULE', () => {
		it('NAMESPACE RULE present before Rule 1', () => {
			const namespacePos = prompt.indexOf('NAMESPACE RULE');
			const rule1Pos = prompt.indexOf('1. DELEGATE');
			expect(namespacePos).toBeGreaterThan(-1);
			expect(rule1Pos).toBeGreaterThan(-1);
			expect(namespacePos).toBeLessThan(rule1Pos);
		});

		it('plan.md must use Phase N headers', () => {
			expect(prompt).toContain('Output to .swarm/plan.md MUST use "## Phase N" headers');
		});
	});

	// Phase 2 - MODE Labels
	describe('MODE Labels', () => {
		const modes = ['MODE: RESUME', 'MODE: CLARIFY', 'MODE: DISCOVER', 'MODE: CONSULT',
					   'MODE: PLAN', 'MODE: CRITIC-GATE', 'MODE: EXECUTE', 'MODE: PHASE-WRAP'];

		modes.forEach(mode => {
			it(`${mode} present`, () => {
				expect(prompt).toContain(mode);
			});
		});

		it('MODE labels in correct order within WORKFLOW section', () => {
			// Find the WORKFLOW section to avoid matching MODE labels mentioned in intro
			const workflowStart = prompt.indexOf('## WORKFLOW');
			const workflowSection = prompt.slice(workflowStart);

			const positions = modes.map(m => workflowSection.indexOf(m));

			// All MODE labels should be found in WORKFLOW section
			positions.forEach((pos, i) => {
				expect(pos).toBeGreaterThan(-1);
			});

			// And they should be in order
			for (let i = 1; i < positions.length; i++) {
				expect(positions[i]).toBeGreaterThan(positions[i - 1]);
			}
		});
	});

	// Phase 3 - HARD STOP
	describe('HARD STOP', () => {
		it('HARD STOP present in CRITIC-GATE', () => {
			expect(prompt).toContain('⛔ HARD STOP');
		});

		it('Must not proceed without checklist', () => {
			expect(prompt).toContain('MUST NOT proceed to MODE: EXECUTE without printing this checklist');
		});

		it('CRITIC-GATE runs once only', () => {
			expect(prompt).toContain('CRITIC-GATE TRIGGER: Run ONCE');
		});
	});

	// Phase 4 - Task Granularity
	describe('TASK GRANULARITY RULES', () => {
		it('TASK GRANULARITY RULES present in MODE: PLAN', () => {
			expect(prompt).toContain('TASK GRANULARITY RULES');
		});

		it('LARGE task is planning error', () => {
			expect(prompt).toContain('LARGE task in the plan is a planning error');
		});

		it('Coder makes zero scope decisions', () => {
			expect(prompt).toContain('Coder makes zero scope decisions');
		});

		it('Compound verbs forbidden', () => {
			expect(prompt).toContain('compound verbs');
		});
	});

	// Phase 5 - Observable Output
	describe('Observable Output', () => {
		it('REQUIRED Print on step 5c (diff)', () => {
			expect(prompt).toContain('→ REQUIRED: Print "diff:');
		});

		it('REQUIRED Print on step 5i (pre_check_batch)', () => {
			expect(prompt).toContain('→ REQUIRED: Print "pre_check_batch:');
		});

		it('REQUIRED Print on step 5j (reviewer)', () => {
			expect(prompt).toContain('→ REQUIRED: Print "reviewer:');
		});

		it('TASK COMPLETION CHECKLIST present', () => {
			expect(prompt).toContain('TASK COMPLETION CHECKLIST');
		});
	});

	// Phase 6 - Failure Counting & Retry
	describe('Failure Counting & Retry', () => {
		it('FAILURE COUNTING present', () => {
			expect(prompt).toContain('FAILURE COUNTING');
		});

		it('Retry counter format specified', () => {
			expect(prompt).toContain('Coder attempt [N/{{QA_RETRY_LIMIT}}] on task');
		});

		it('RETRY PROTOCOL present', () => {
			expect(prompt).toContain('RETRY PROTOCOL');
		});

		it('Structured rejection format specified', () => {
			expect(prompt).toContain('GATE FAILED:');
		});
	});

	// Phase 7 - Anti-Rationalization
	describe('Anti-Rationalization', () => {
		it('ANTI-EXEMPTION RULES present', () => {
			expect(prompt).toContain('ANTI-EXEMPTION RULES');
		});

		it('No simple changes rule', () => {
			expect(prompt).toContain('There are NO simple changes');
		});

		it('PRE-COMMIT RULE present', () => {
			expect(prompt).toContain('PRE-COMMIT RULE');
		});

		it('Commit without QA is violation', () => {
			expect(prompt).toContain('workflow violation');
		});
	});
});
