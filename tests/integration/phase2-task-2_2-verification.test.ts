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

		expect(parsed.requiredTypes).toEqual(['review']);
		expect(parsed.completeness).toBeTypeOf('number');
		expect(parsed.tasksWithFullEvidence).toBeDefined();

		for (const taskId of ['1.1', '1.2', '1.3', '1.4', '1.5']) {
			expect(parsed.tasksWithFullEvidence).toContain(taskId);
		}
	});

	test('evidence_check reports expected missing test evidence with required_types=review,test', async () => {
		const parsed = await runEvidenceCheck('review,test');

		expect(parsed.requiredTypes).toEqual(['review', 'test']);
		expect(parsed.gaps).toBeDefined();

		for (const taskId of ['1.1', '1.2', '1.3', '1.4', '1.5']) {
			const gap = parsed.gaps?.find((item) => item.taskId === taskId);
			expect(gap).toBeDefined();
			expect(gap?.present).toContain('review');
			expect(gap?.missing).toContain('test');
		}
	});
});
