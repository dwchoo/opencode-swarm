import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evidence_check } from '../../../src/tools/evidence-check';

const PHASE2_REVIEW_FILES = [
	'2_1-review.json',
	'2_2-review.json',
	'2_3-review.json',
];

const SOURCE_EVIDENCE_DIR = join(process.cwd(), '.swarm', 'evidence');

const PLAN_FIXTURE = `
- [x] 2.1: Evidence preflight
- [x] 2.2: Review backfill
- [x] 2.3: Test backfill review
`;

let originalCwd = '';
let sandboxDir = '';

function setupSandbox(): string {
	const tmp = mkdtempSync(join(tmpdir(), 'phase2-review-evidence-attack-'));
	mkdirSync(join(tmp, '.swarm', 'evidence'), { recursive: true });
	writeFileSync(join(tmp, '.swarm', 'plan.md'), PLAN_FIXTURE, 'utf-8');

	for (const file of PHASE2_REVIEW_FILES) {
		const sourcePath = join(SOURCE_EVIDENCE_DIR, file);
		const targetPath = join(tmp, '.swarm', 'evidence', file);
		writeFileSync(targetPath, readFileSync(sourcePath, 'utf-8'), 'utf-8');
	}

	return tmp;
}

async function runEvidenceCheck(required_types: string): Promise<{
	completeness: number;
	tasksWithFullEvidence: string[];
	gaps: Array<{ taskId: string; missing: string[]; present: string[] }>;
}> {
	const result = await evidence_check.execute({ required_types }, {} as never);
	return JSON.parse(result) as {
		completeness: number;
		tasksWithFullEvidence: string[];
		gaps: Array<{ taskId: string; missing: string[]; present: string[] }>;
	};
}

describe('adversarial ingestion checks for 2_1/2_2/2_3 review evidence', () => {
	beforeEach(() => {
		originalCwd = process.cwd();
		sandboxDir = setupSandbox();
		process.chdir(sandboxDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(sandboxDir, { recursive: true, force: true });
	});

	test('rejects task-id spoof in canonical 2_2-review filename', async () => {
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', '2_2-review.json'),
			JSON.stringify({
				task_id: '2.1',
				type: 'review',
				timestamp: '2026-02-27T00:00:00Z',
				agent: 'reviewer',
				verdict: 'approved',
				summary: 'spoof mismatch',
				risk: 'low',
				issues: [],
			}),
			'utf-8',
		);

		const parsed = await runEvidenceCheck('review');

		expect(parsed.completeness).toBeCloseTo(0.67, 2);
		expect(parsed.tasksWithFullEvidence).toEqual(['2.1', '2.3']);
		expect(parsed.gaps.find((gap) => gap.taskId === '2.2')?.missing).toContain(
			'review',
		);
	});

	test('rejects type mismatch where 2_3-review payload claims test', async () => {
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', '2_3-review.json'),
			JSON.stringify({
				task_id: '2.3',
				type: 'test',
				timestamp: '2026-02-27T00:00:00Z',
				agent: 'reviewer',
				verdict: 'approved',
				summary: 'type mismatch',
				tests_passed: 1,
				tests_failed: 0,
			}),
			'utf-8',
		);

		const parsed = await runEvidenceCheck('review');

		expect(parsed.completeness).toBeCloseTo(0.67, 2);
		expect(parsed.tasksWithFullEvidence).toEqual(['2.1', '2.2']);
		expect(parsed.gaps.find((gap) => gap.taskId === '2.3')?.missing).toContain(
			'review',
		);
	});

	test('blocks symlink substitution for 2_1-review record', async () => {
		const externalTarget = join(sandboxDir, 'outside-2_1-review.json');
		writeFileSync(
			externalTarget,
			JSON.stringify({
				task_id: '2.1',
				type: 'review',
				timestamp: '2026-02-27T00:00:00Z',
				agent: 'reviewer',
				verdict: 'approved',
				summary: 'symlink payload',
				risk: 'low',
				issues: [],
			}),
			'utf-8',
		);

		const symlinkPath = join(sandboxDir, '.swarm', 'evidence', '2_1-review.json');
		unlinkSync(symlinkPath);
		symlinkSync(externalTarget, symlinkPath);

		const parsed = await runEvidenceCheck('review');

		expect(parsed.completeness).toBeCloseTo(0.67, 2);
		expect(parsed.tasksWithFullEvidence).toEqual(['2.2', '2.3']);
		expect(parsed.gaps.find((gap) => gap.taskId === '2.1')?.missing).toContain(
			'review',
		);
	});

	test('ignores non-matching filename tricks for 2_2 evidence replacement', async () => {
		unlinkSync(join(sandboxDir, '.swarm', 'evidence', '2_2-review.json'));
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', '2.2-review.json'),
			JSON.stringify({ task_id: '2.2', type: 'review' }),
			'utf-8',
		);
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', '2_2-review.json.bak'),
			JSON.stringify({ task_id: '2.2', type: 'review' }),
			'utf-8',
		);

		const parsed = await runEvidenceCheck('review');

		expect(parsed.completeness).toBeCloseTo(0.67, 2);
		expect(parsed.tasksWithFullEvidence).toEqual(['2.1', '2.3']);
		expect(parsed.gaps.find((gap) => gap.taskId === '2.2')?.missing).toContain(
			'review',
		);
	});
});
