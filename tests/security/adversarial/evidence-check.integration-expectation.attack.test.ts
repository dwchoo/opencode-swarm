import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
	mkdtempSync,
	mkdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { evidence_check } from '../../../src/tools/evidence-check';

let originalCwd = '';
let sandboxDir = '';

const PLAN_FIXTURE = '- [x] 2.2: Backfill flat review evidence files';

function setupSandbox(): string {
	const tmp = mkdtempSync(join(tmpdir(), 'evidence-check-int-attack-'));
	mkdirSync(join(tmp, '.swarm', 'evidence'), { recursive: true });
	writeFileSync(join(tmp, '.swarm', 'plan.md'), PLAN_FIXTURE, 'utf-8');
	return tmp;
}

function writeEvidence(filename: string, payload: unknown): void {
	const filePath = join(sandboxDir, '.swarm', 'evidence', filename);
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, JSON.stringify(payload), 'utf-8');
}

function writeEvidenceRaw(filename: string, raw: string): void {
	const filePath = join(sandboxDir, '.swarm', 'evidence', filename);
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, raw, 'utf-8');
}

function seedCanonicalEvidence(): void {
	writeEvidence('2_2-review.json', {
		task_id: '2.2',
		type: 'review',
		timestamp: '2026-02-27T00:00:00Z',
		agent: 'reviewer',
		verdict: 'approved',
		summary: 'review complete',
		risk: 'low',
		issues: [],
	});
	writeEvidence('2_2-test.json', {
		task_id: '2.2',
		type: 'test',
		timestamp: '2026-02-27T00:00:00Z',
		agent: 'test-engineer',
		verdict: 'pass',
		summary: 'tests complete',
		tests_passed: 8,
		tests_failed: 0,
	});
}

async function runEvidenceCheck() {
	const result = await evidence_check.execute(
		{ required_types: 'review,test' },
		{} as never,
	);
	return JSON.parse(result) as {
		completeness: number;
		tasksWithFullEvidence: string[];
		gaps: Array<{ taskId: string; missing: string[]; present: string[] }>;
	};
}

describe('adversarial-only: evidence-check attack vectors after integration update', () => {
	beforeEach(() => {
		originalCwd = process.cwd();
		sandboxDir = setupSandbox();
		process.chdir(sandboxDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(sandboxDir, { recursive: true, force: true });
	});

	test('path traversal placement outside evidence directory is ignored', async () => {
		seedCanonicalEvidence();
		writeFileSync(
			join(sandboxDir, '.swarm', '2_2-review.json'),
			JSON.stringify({ task_id: '2.2', type: 'review' }),
			'utf-8',
		);

		const parsed = await runEvidenceCheck();

		expect(parsed.completeness).toBe(1);
		expect(parsed.tasksWithFullEvidence).toEqual(['2.2']);
		expect(parsed.gaps).toHaveLength(0);
	});

	test('symlink substitution for canonical review file is blocked', async () => {
		seedCanonicalEvidence();

		const outsideTarget = join(sandboxDir, 'outside-review.json');
		writeFileSync(
			outsideTarget,
			JSON.stringify({ task_id: '2.2', type: 'review' }),
			'utf-8',
		);
		symlinkSync(outsideTarget, join(sandboxDir, '.swarm', 'evidence', '2_2-review.link'));
		symlinkSync(outsideTarget, join(sandboxDir, '.swarm', 'evidence', '2_2-review.json.tmp'));
		rmSync(join(sandboxDir, '.swarm', 'evidence', '2_2-review.json'));
		symlinkSync(outsideTarget, join(sandboxDir, '.swarm', 'evidence', '2_2-review.json'));

		const parsed = await runEvidenceCheck();

		expect(parsed.completeness).toBe(0);
		expect(parsed.tasksWithFullEvidence).toHaveLength(0);
		expect(parsed.gaps.find((gap) => gap.taskId === '2.2')?.missing).toContain(
			'review',
		);
		expect(parsed.gaps.find((gap) => gap.taskId === '2.2')?.present).toContain(
			'test',
		);
	});

	test('malformed payloads do not satisfy review/test requirements', async () => {
		writeEvidenceRaw('2_2-review.json', '{ invalid json payload');
		writeEvidence('2_2-test.json', {
			task_id: '2.2',
			type: 'test',
			tests_passed: 'eight',
			tests_failed: 0,
		});

		const parsed = await runEvidenceCheck();

		expect(parsed.completeness).toBe(0);
		expect(parsed.tasksWithFullEvidence).toHaveLength(0);
		expect(parsed.gaps.find((gap) => gap.taskId === '2.2')?.missing).toEqual([
			'review',
			'test',
		]);
	});

	test('spoofed records with filename/payload mismatch are rejected', async () => {
		writeEvidence('2_2-review.json', {
			task_id: '2.1',
			type: 'review',
		});
		writeEvidence('2_2-test.json', {
			task_id: '2.2',
			type: 'review',
		});

		const parsed = await runEvidenceCheck();

		expect(parsed.completeness).toBe(0);
		expect(parsed.tasksWithFullEvidence).toHaveLength(0);
		expect(parsed.gaps.find((gap) => gap.taskId === '2.2')?.missing).toEqual([
			'review',
			'test',
		]);
	});
});
