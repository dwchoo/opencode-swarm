import { beforeEach, afterEach, describe, expect, it } from 'bun:test';
import {
	mkdtempSync,
	mkdirSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { evidence_check } from '../../src/tools/evidence-check';
import type { ToolContext } from '@opencode-ai/plugin';

let originalCwd: string;
let testDir: string;

function setupTestDir(): string {
	const tmp = mkdtempSync(join(tmpdir(), 'evidence-check-adversarial-'));
	mkdirSync(join(tmp, '.swarm', 'evidence'), { recursive: true });
	return tmp;
}

function createPlanFile(content: string): void {
	writeFileSync(join(testDir, '.swarm', 'plan.md'), content, 'utf-8');
}

function createEvidenceJson(filename: string, payload: object): void {
	const filePath = join(testDir, '.swarm', 'evidence', filename);
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, JSON.stringify(payload), 'utf-8');
}

function createEvidenceRaw(filename: string, content: string): void {
	const filePath = join(testDir, '.swarm', 'evidence', filename);
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, 'utf-8');
}

function createPlanForTask22(): void {
	createPlanFile('- [x] 2.2: Backfill flat review evidence files');
}

function runEvidenceCheck(requiredTypes?: string) {
	const args = requiredTypes ? { required_types: requiredTypes } : {};
	const mockContext: ToolContext = {
		sessionID: 'adversarial-session',
		messageID: 'adversarial-message',
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

describe('ADVERSARIAL: evidence-check attack vectors', () => {
	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = setupTestDir();
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(testDir, { recursive: true, force: true });
	});

	it('rejects shell metacharacter payloads in required_types', async () => {
		createPlanForTask22();

		const parsed = await parseResult(runEvidenceCheck('review;cat /etc/passwd'));

		expect(parsed.error).toContain('shell metacharacters');
		expect(parsed.completeness).toBe(0);
	});

	it('rejects oversized required_types payloads and token floods', async () => {
		createPlanForTask22();

		const oversized = await parseResult(runEvidenceCheck(`a${'b'.repeat(512)}`));
		expect(oversized.error).toContain('exceeds max length');

		const flood = Array.from({ length: 33 }, (_, i) => `t${i}`).join(',');
		const tokenFlood = await parseResult(runEvidenceCheck(flood));
		expect(tokenFlood.error).toContain('max token count');
	});

	it('rejects malformed required_types with empty or duplicate tokens', async () => {
		createPlanForTask22();

		const emptyToken = await parseResult(runEvidenceCheck('review,,test'));
		expect(emptyToken.error).toContain('empty token');

		const duplicateToken = await parseResult(runEvidenceCheck('review,Review'));
		expect(duplicateToken.error).toContain('duplicate token');
	});

	it('skips oversized evidence files above 1MB budget', async () => {
		createPlanForTask22();

		const largeBlob = 'x'.repeat(1024 * 1024 + 64);
		createEvidenceJson('2_2-review.json', {
			task_id: '2.2',
			type: 'review',
			summary: largeBlob,
		});
		createEvidenceJson('2_2-test.json', { task_id: '2.2', type: 'test' });

		const reviewStat = statSync(join(testDir, '.swarm', 'evidence', '2_2-review.json'));
		expect(reviewStat.size).toBeGreaterThan(1024 * 1024);

		const parsed = await parseResult(runEvidenceCheck());
		expect(parsed.gaps).toHaveLength(1);
		expect(parsed.gaps[0].taskId).toBe('2.2');
		expect(parsed.gaps[0].missing).toContain('review');
		expect(parsed.gaps[0].present).toContain('test');
	});

	it('skips path-traversal placement outside .swarm/evidence', async () => {
		createPlanForTask22();

		const traversalPath = join(testDir, '.swarm', 'evidence', '..', '2_2-review.json');
		writeFileSync(
			traversalPath,
			JSON.stringify({ task_id: '2.2', type: 'review' }),
			'utf-8',
		);
		createEvidenceJson('2_2-test.json', { task_id: '2.2', type: 'test' });

		const parsed = await parseResult(runEvidenceCheck());
		expect(parsed.gaps).toHaveLength(1);
		expect(parsed.gaps[0].missing).toContain('review');
	});

	it('blocks symlink evidence records (O_NOFOLLOW + lstat checks)', async () => {
		createPlanForTask22();

		const externalTarget = join(testDir, 'outside-review.json');
		writeFileSync(
			externalTarget,
			JSON.stringify({ task_id: '2.2', type: 'review' }),
			'utf-8',
		);

		const symlinkPath = join(testDir, '.swarm', 'evidence', '2_2-review.json');
		symlinkSync(externalTarget, symlinkPath);
		createEvidenceJson('2_2-test.json', { task_id: '2.2', type: 'test' });

		const parsed = await parseResult(runEvidenceCheck());
		expect(parsed.gaps).toHaveLength(1);
		expect(parsed.gaps[0].missing).toContain('review');
		expect(parsed.gaps[0].present).toContain('test');
	});

	it('rejects spoofed evidence where filename and record task/type disagree', async () => {
		createPlanForTask22();

		createEvidenceJson('2_2-review.json', { task_id: '2.1', type: 'review' });
		createEvidenceJson('2_2-test.json', { task_id: '2.2', type: 'test' });

		const parsed = await parseResult(runEvidenceCheck());
		expect(parsed.gaps).toHaveLength(1);
		expect(parsed.gaps[0].taskId).toBe('2.2');
		expect(parsed.gaps[0].missing).toContain('review');
		expect(parsed.gaps[0].present).toContain('test');
	});

	it('skips malformed evidence payloads (invalid JSON + wrong field types)', async () => {
		createPlanForTask22();

		createEvidenceRaw('2_2-review.json', '{ bad json }');
		createEvidenceJson('2_2-test.json', {
			task_id: '2.2',
			type: 'test',
			tests_passed: 'ten',
			tests_failed: 0,
		});

		const parsed = await parseResult(runEvidenceCheck());
		expect(parsed.gaps).toHaveLength(1);
		expect(parsed.gaps[0].missing).toContain('review');
		expect(parsed.gaps[0].missing).toContain('test');
	});
});
