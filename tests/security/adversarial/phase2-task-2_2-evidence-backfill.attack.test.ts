import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evidence_check } from '../../../src/tools/evidence-check';

const PHASE1_REVIEW_FILES = [
	'1_1-review.json',
	'1_2-review.json',
	'1_3-review.json',
	'1_4-review.json',
	'1_5-review.json',
];

const SOURCE_EVIDENCE_DIR = join(process.cwd(), '.swarm', 'evidence');

const PLAN_FIXTURE = `
- [x] 1.1: Task one
- [x] 1.2: Task two
- [x] 1.3: Task three
- [x] 1.4: Task four
- [x] 1.5: Task five
`;

let originalCwd = '';
let sandboxDir = '';

function setupSandbox(): string {
	const tmp = mkdtempSync(join(tmpdir(), 'phase2-2_2-attack-'));
	mkdirSync(join(tmp, '.swarm', 'evidence'), { recursive: true });
	writeFileSync(join(tmp, '.swarm', 'plan.md'), PLAN_FIXTURE, 'utf-8');

	for (const file of PHASE1_REVIEW_FILES) {
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

describe('phase 2.2 evidence backfill adversarial security', () => {
	beforeEach(() => {
		originalCwd = process.cwd();
		sandboxDir = setupSandbox();
		process.chdir(sandboxDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(sandboxDir, { recursive: true, force: true });
	});

	test('malformed JSON payload does not corrupt review completeness', async () => {
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', '1_3-review-malformed.json'),
			'{"task_id":"1.3","type":"review",',
			'utf-8',
		);

		const parsed = await runEvidenceCheck('review');

		expect(parsed.completeness).toBe(1);
		expect(parsed.tasksWithFullEvidence).toHaveLength(5);
	});

	test('schema abuse payloads are ignored (task_id/type not strings)', async () => {
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', '1_4-review-schema-abuse.json'),
			JSON.stringify({ task_id: { id: '1.4' }, type: ['review'] }),
			'utf-8',
		);

		const parsed = await runEvidenceCheck('review');

		expect(parsed.completeness).toBe(1);
		expect(parsed.tasksWithFullEvidence).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5']);
	});

	test('type confusion payload does not satisfy review requirement', async () => {
		unlinkSync(join(sandboxDir, '.swarm', 'evidence', '1_5-review.json'));
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', '1_5-review-confused.json'),
			JSON.stringify({ task_id: '1.5', type: { value: 'review' } }),
			'utf-8',
		);

		const parsed = await runEvidenceCheck('review');

		expect(parsed.completeness).toBe(0.8);
		expect(parsed.gaps.find((gap) => gap.taskId === '1.5')?.missing).toContain('review');
	});

	test('filename trickery payloads do not alter evidence resolution', async () => {
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', '1_2-review.json.bak'),
			JSON.stringify({ task_id: '1.2', type: 'review' }),
			'utf-8',
		);
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', '1.2-review.json'),
			JSON.stringify({ task_id: '1.2', type: 'review' }),
			'utf-8',
		);
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', '1_2-review.JSON'),
			JSON.stringify({ task_id: '1.2', type: 'review' }),
			'utf-8',
		);

		const parsed = await runEvidenceCheck('review');

		expect(parsed.completeness).toBe(1);
		expect(parsed.tasksWithFullEvidence).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5']);
	});

	test('task_id spoofing via arbitrary filename should not satisfy missing canonical evidence', async () => {
		unlinkSync(join(sandboxDir, '.swarm', 'evidence', '1_1-review.json'));
		writeFileSync(
			join(sandboxDir, '.swarm', 'evidence', 'spoofed-review.json'),
			JSON.stringify({ task_id: '1.1', type: 'review' }),
			'utf-8',
		);

		const parsed = await runEvidenceCheck('review');

		expect(parsed.completeness).toBe(0.8);
		expect(parsed.tasksWithFullEvidence).not.toContain('1.1');
		expect(parsed.gaps.find((gap) => gap.taskId === '1.1')?.missing).toContain('review');
	});
});
