import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ReviewEvidenceSchema } from '../../src/config/evidence-schema';
import { evidence_check } from '../../src/tools/evidence-check';

const REVIEW_FILES = [
	'1_1-review.json',
	'1_2-review.json',
	'1_3-review.json',
	'1_4-review.json',
	'1_5-review.json',
];

const PHASE1_TASK_IDS = ['1.1', '1.2', '1.3', '1.4', '1.5'];

const EVIDENCE_DIR = join(process.cwd(), '.swarm', 'evidence');

async function runEvidenceCheck(required_types: string) {
	const result = await evidence_check.execute({ required_types }, {} as never);
	return JSON.parse(result) as {
		requiredTypes?: string[];
		completeness?: number;
		tasksWithFullEvidence?: string[];
		gaps?: Array<{ taskId: string; missing: string[]; present: string[] }>;
	};
}

function expectRequiredTypes(actual: string[] | undefined, expected: string[]) {
	expect(actual).toBeDefined();
	expect([...(actual ?? [])].sort()).toEqual([...expected].sort());
}

describe('Phase 2.2 review evidence verification', () => {
	test('parses all new review evidence files against ReviewEvidenceSchema', () => {
		for (const filename of REVIEW_FILES) {
			const content = readFileSync(join(EVIDENCE_DIR, filename), 'utf-8');
			const parsedJson = JSON.parse(content);
			const parsed = ReviewEvidenceSchema.safeParse(parsedJson);

			expect(parsed.success).toBe(true);
			if (parsed.success) {
				expect(parsed.data.type).toBe('review');
				expect(parsed.data.issues).toEqual([]);
				expect(parsed.data.metadata).toBeDefined();
			}
		}
	});

	test('evidence_check recognizes phase 1 review backfill with required_types=review', async () => {
		const parsed = await runEvidenceCheck('review');

		expectRequiredTypes(parsed.requiredTypes, ['review']);
		expect(parsed.completeness).toBeTypeOf('number');
		expect(parsed.tasksWithFullEvidence).toBeDefined();

		for (const taskId of PHASE1_TASK_IDS) {
			expect(parsed.tasksWithFullEvidence).toContain(taskId);
		}
	});

	test('evidence_check reports full phase 1 evidence with required_types=review,test', async () => {
		const parsed = await runEvidenceCheck('review,test');

		expectRequiredTypes(parsed.requiredTypes, ['review', 'test']);
		expect(parsed.completeness).toBeTypeOf('number');
		expect(parsed.tasksWithFullEvidence).toBeDefined();
		expect(parsed.gaps).toBeDefined();

		for (const taskId of PHASE1_TASK_IDS) {
			expect(parsed.tasksWithFullEvidence).toContain(taskId);

			const gap = parsed.gaps?.find((item) => item.taskId === taskId);
			expect(gap).toBeUndefined();
		}
	});
});
