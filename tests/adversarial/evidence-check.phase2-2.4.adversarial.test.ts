import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
	mkdtempSync,
	mkdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { evidence_check } from '../../src/tools/evidence-check';
import type { ToolContext } from '@opencode-ai/plugin';

let originalCwd = '';
let testDir = '';

function setupTestDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'evidence-check-phase2-2-4-'));
	mkdirSync(join(dir, '.swarm', 'evidence'), { recursive: true });
	return dir;
}

function createPlan(): void {
	writeFileSync(
		join(testDir, '.swarm', 'plan.md'),
		'- [x] 2.4: Harden evidence-check against adversarial input',
		'utf-8',
	);
}

function writeEvidenceJson(filename: string, payload: object): void {
	const filePath = join(testDir, '.swarm', 'evidence', filename);
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, JSON.stringify(payload), 'utf-8');
}

function writeEvidenceRaw(filename: string, content: string): void {
	const filePath = join(testDir, '.swarm', 'evidence', filename);
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, 'utf-8');
}

function runEvidenceCheck(requiredTypes?: string) {
	const args = requiredTypes ? { required_types: requiredTypes } : {};
	const mockContext: ToolContext = {
		sessionID: 'phase2-2-4-session',
		messageID: 'phase2-2-4-message',
		agent: 'test-engineer',
		directory: testDir,
		worktree: testDir,
		abort: new AbortController().signal,
		metadata: () => {},
		ask: async () => undefined,
	};
	return evidence_check.execute(args, mockContext);
}

async function parseResult(result: ReturnType<typeof evidence_check.execute>) {
	return JSON.parse(await result);
}

describe('adversarial-only: evidence_check attack vectors (phase 2.4)', () => {
	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = setupTestDir();
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(testDir, { recursive: true, force: true });
	});

	it('rejects malformed required_types payloads', async () => {
		createPlan();

		const metachar = await parseResult(runEvidenceCheck('review;cat /etc/passwd'));
		expect(metachar.error).toContain('shell metacharacters');

		const control = await parseResult(runEvidenceCheck('review,test\nattack'));
		expect(control.error).toContain('control characters');

		const duplicate = await parseResult(runEvidenceCheck('review,Review'));
		expect(duplicate.error).toContain('duplicate token');

		const flood = Array.from({ length: 33 }, (_, i) => `t${i}`).join(',');
		const tokenFlood = await parseResult(runEvidenceCheck(flood));
		expect(tokenFlood.error).toContain('max token count');
	});

	it('skips oversized evidence files over per-file budget', async () => {
		createPlan();

		const oversized = 'x'.repeat(1024 * 1024 + 128);
		writeEvidenceJson('2_4-review.json', {
			task_id: '2.4',
			type: 'review',
			summary: oversized,
		});
		writeEvidenceJson('2_4-test.json', { task_id: '2.4', type: 'test' });

		const parsed = await parseResult(runEvidenceCheck());
		expect(parsed.gaps).toHaveLength(1);
		expect(parsed.gaps[0].taskId).toBe('2.4');
		expect(parsed.gaps[0].missing).toContain('review');
		expect(parsed.gaps[0].present).toContain('test');
	});

	it('ignores path-traversal placement outside evidence directory', async () => {
		createPlan();

		const traversalPath = join(testDir, '.swarm', 'evidence', '..', '2_4-review.json');
		writeFileSync(
			traversalPath,
			JSON.stringify({ task_id: '2.4', type: 'review' }),
			'utf-8',
		);
		writeEvidenceJson('2_4-test.json', { task_id: '2.4', type: 'test' });

		const parsed = await parseResult(runEvidenceCheck());
		expect(parsed.gaps).toHaveLength(1);
		expect(parsed.gaps[0].missing).toContain('review');
		expect(parsed.gaps[0].present).toContain('test');
	});

	it('blocks symlink evidence files', async () => {
		createPlan();

		const external = join(testDir, 'outside-review.json');
		writeFileSync(external, JSON.stringify({ task_id: '2.4', type: 'review' }), 'utf-8');
		symlinkSync(external, join(testDir, '.swarm', 'evidence', '2_4-review.json'));
		writeEvidenceJson('2_4-test.json', { task_id: '2.4', type: 'test' });

		const parsed = await parseResult(runEvidenceCheck());
		expect(parsed.gaps).toHaveLength(1);
		expect(parsed.gaps[0].missing).toContain('review');
		expect(parsed.gaps[0].present).toContain('test');
	});

	it('rejects spoofed filename/content combinations and malformed JSON', async () => {
		createPlan();

		writeEvidenceJson('2_4-review.json', { task_id: '2.3', type: 'review' });
		writeEvidenceRaw('2_4-test.json', '{ invalid json }');

		const parsed = await parseResult(runEvidenceCheck());
		expect(parsed.gaps).toHaveLength(1);
		expect(parsed.gaps[0].taskId).toBe('2.4');
		expect(parsed.gaps[0].missing).toContain('review');
		expect(parsed.gaps[0].missing).toContain('test');
	});
});
