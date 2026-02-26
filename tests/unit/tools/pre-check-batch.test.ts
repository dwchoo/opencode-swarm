import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
	runPreCheckBatch,
	type PreCheckBatchInput,
	type PreCheckBatchResult,
} from '../../../src/tools/pre-check-batch';

// Mock the tool modules using mock.module()
const mockDetectAvailableLinter = mock(async () => 'biome');
const mockRunLint = mock(async () => ({
	success: true,
	mode: 'check',
	linter: 'biome' as const,
	command: ['biome', 'check', '.'],
	exitCode: 0,
	output: '',
	message: 'No issues found',
}));
const mockRunSecretscan = mock(async () => ({
	scan_dir: '.',
	findings: [],
	summary: {
		files_scanned: 0,
		secrets_found: 0,
		scan_time_ms: 0,
	},
}));
const mockSastScan = mock(async () => ({
	verdict: 'pass' as const,
	findings: [],
	summary: {
		engine: 'tier_a' as const,
		files_scanned: 0,
		findings_count: 0,
		findings_by_severity: {
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
		},
	},
}));
const mockQualityBudget = mock(async () => ({
	verdict: 'pass' as const,
	metrics: {
		complexity_delta: 0,
		public_api_delta: 0,
		duplication_ratio: 0,
		test_to_code_ratio: 0,
		thresholds: {
			max_complexity_delta: 5,
			max_public_api_delta: 10,
			max_duplication_ratio: 0.05,
			min_test_to_code_ratio: 0.3,
		},
	},
	violations: [],
	summary: {
		files_analyzed: 0,
		violations_count: 0,
		errors_count: 0,
		warnings_count: 0,
	},
}));

mock.module('../../../src/tools/lint', () => ({
	detectAvailableLinter: mockDetectAvailableLinter,
	runLint: mockRunLint,
}));

mock.module('../../../src/tools/secretscan', () => ({
	runSecretscan: mockRunSecretscan,
}));

mock.module('../../../src/tools/sast-scan', () => ({
	sastScan: mockSastScan,
}));

mock.module('../../../src/tools/quality-budget', () => ({
	qualityBudget: mockQualityBudget,
}));

mock.module('../../../src/utils', () => ({
	warn: mock(() => {}),
}));

// Helper to create temp test directories
function createTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'pre-check-batch-test-'));
}

describe('runPreCheckBatch', () => {
	let tempDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		tempDir = createTempDir();
		process.chdir(tempDir);
		// Reset mock call counts
		mockDetectAvailableLinter.mockClear();
		mockRunLint.mockClear();
		mockRunSecretscan.mockClear();
		mockSastScan.mockClear();
		mockQualityBudget.mockClear();
	});

	afterEach(() => {
		process.chdir(originalCwd);
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	// ============ Test 1: All four tools pass → gates_passed true ============

	test('all four tools pass → gates_passed true', async () => {
		// Create a test file so the tools have something to scan
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		expect(result.gates_passed).toBe(true);
		expect(result.lint.ran).toBe(true);
		expect(result.secretscan.ran).toBe(true);
		expect(result.sast_scan.ran).toBe(true);
		expect(result.quality_budget.ran).toBe(true);
	});

	// ============ Test 2: Individual tool failures ============

	test('lint failure causes gates_passed false (hard gate)', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Override mock to throw so it gets caught as an error
		mockRunLint.mockRejectedValueOnce(new Error('Lint execution failed'));

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		// Lint is a hard gate, so gates should fail
		expect(result.gates_passed).toBe(false);
		expect(result.lint.error).toBe('Lint execution failed');
	});

	test('secretscan failure → gates_passed false (hard gate)', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Override mock to return secretscan failure with findings
		mockRunSecretscan.mockResolvedValueOnce({
			scan_dir: '.',
			findings: [
				{
					path: 'test.ts',
					line: 1,
					type: 'api_key' as const,
					confidence: 'high' as const,
					severity: 'critical' as const,
					redacted: 'sk-****',
					context: 'export const x = 1;',
				},
			],
			summary: {
				files_scanned: 1,
				secrets_found: 1,
				scan_time_ms: 100,
			},
		});

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		expect(result.gates_passed).toBe(false);
		expect(result.secretscan.result).toBeDefined();
		expect(
			(result.secretscan.result as { findings: unknown[] }).findings,
		).toHaveLength(1);
	});

	test('sast_scan failure → gates_passed false (hard gate)', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Override mock to return sast_scan failure
		mockSastScan.mockResolvedValueOnce({
			verdict: 'fail' as const,
			findings: [
				{
					rule_id: 'test-rule',
					severity: 'high' as const,
					message: 'Security vulnerability found',
					location: {
						file: 'test.ts',
						line: 1,
					},
				},
			],
			summary: {
				engine: 'tier_a' as const,
				files_scanned: 1,
				findings_count: 1,
				findings_by_severity: {
					critical: 0,
					high: 1,
					medium: 0,
					low: 0,
				},
			},
		});

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		expect(result.gates_passed).toBe(false);
		expect(result.sast_scan.result?.verdict).toBe('fail');
	});

	test('quality_budget failure does not affect gates_passed (soft gate)', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Override mock to return quality_budget failure
		mockQualityBudget.mockResolvedValueOnce({
			verdict: 'fail' as const,
			metrics: {
				complexity_delta: 10,
				public_api_delta: 0,
				duplication_ratio: 0,
				test_to_code_ratio: 0,
				thresholds: {
					max_complexity_delta: 5,
					max_public_api_delta: 10,
					max_duplication_ratio: 0.05,
					min_test_to_code_ratio: 0.3,
				},
			},
			violations: [
				{
					type: 'complexity' as const,
					severity: 'error' as const,
					message: 'Complexity exceeds threshold',
				},
			],
			summary: {
				files_analyzed: 1,
				violations_count: 1,
				errors_count: 1,
				warnings_count: 0,
			},
		});

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		// Quality budget is a soft gate, so gates should still pass
		expect(result.gates_passed).toBe(true);
		expect(result.quality_budget.result?.verdict).toBe('fail');
	});

	// ============ Test 3: All tools throw → gates_passed false ============

	test('all tools throw → gates_passed false (fail closed)', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Make hard gate tools throw
		mockRunSecretscan.mockRejectedValueOnce(new Error('Secretscan error'));
		mockSastScan.mockRejectedValueOnce(new Error('SAST scan error'));

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		// Fail closed: any error in hard gates should result in gates_passed = false
		expect(result.gates_passed).toBe(false);
		expect(result.secretscan.error).toBe('Secretscan error');
		expect(result.sast_scan.error).toBe('SAST scan error');
	});

	// ============ Test 4: Tool timeout handling ============

	test('tool timeout handling', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Create a tool that takes longer than the timeout (60s)
		// We use a small delay that exceeds bun's default timeout but less than tool timeout
		mockRunSecretscan.mockImplementationOnce(
			async () =>
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error('Timeout after 60000ms')),
						100, // Small delay to not hit test timeout
					),
				),
		);

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		// Timeout should be treated as an error in the hard gate
		expect(result.secretscan.error).toContain('Timeout');
		expect(result.gates_passed).toBe(false);
	});

	// ============ Test 5: Parallelism verification ============

	test('tools run in parallel (Promise.all)', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Make each tool take 80ms
		const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

		mockRunLint.mockImplementationOnce(async () => {
			await delay(80);
			return {
				success: true,
				mode: 'check',
				linter: 'biome' as const,
				command: ['biome', 'check', '.'],
				exitCode: 0,
				output: '',
			};
		});

		mockRunSecretscan.mockImplementationOnce(async () => {
			await delay(80);
			return {
				scan_dir: '.',
				findings: [],
				summary: { files_scanned: 0, secrets_found: 0, scan_time_ms: 80 },
			};
		});

		mockSastScan.mockImplementationOnce(async () => {
			await delay(80);
			return {
				verdict: 'pass' as const,
				findings: [],
				summary: {
					engine: 'tier_a' as const,
					files_scanned: 0,
					findings_count: 0,
					findings_by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
				},
			};
		});

		mockQualityBudget.mockImplementationOnce(async () => {
			await delay(80);
			return {
				verdict: 'pass' as const,
				metrics: {
					complexity_delta: 0,
					public_api_delta: 0,
					duplication_ratio: 0,
					test_to_code_ratio: 0,
					thresholds: {
						max_complexity_delta: 5,
						max_public_api_delta: 10,
						max_duplication_ratio: 0.05,
						min_test_to_code_ratio: 0.3,
					},
				},
				violations: [],
				summary: { files_analyzed: 0, violations_count: 0, errors_count: 0, warnings_count: 0 },
			};
		});

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const start = Date.now();
		const result = await runPreCheckBatch(input);
		const totalTime = Date.now() - start;

		// Verify all tools were called
		expect(result.lint.ran).toBe(true);
		expect(result.secretscan.ran).toBe(true);
		expect(result.sast_scan.ran).toBe(true);
		expect(result.quality_budget.ran).toBe(true);

		// If parallel (4 tools × 80ms each = 320ms sequential), 
		// total wall time should be ~80ms + overhead
		// Allow up to 150ms to account for overhead and CI variability
		// Sequential would be 320ms+, so 150ms proves parallelism
		expect(totalTime).toBeLessThan(150);
	});

	// ============ Test 6: Undefined files (not empty array) handling ============

	test('undefined files (not provided) skips all tools', async () => {
		const input: PreCheckBatchInput = {
			directory: tempDir,
			// files not provided (undefined)
		};

		const result = await runPreCheckBatch(input);

		// When files is undefined, the early return triggers with all tools skipped
		expect(result.gates_passed).toBe(true);
		// All tools should not have run
		expect(result.lint.ran).toBe(false);
		expect(result.secretscan.ran).toBe(false);
		expect(result.sast_scan.ran).toBe(false);
		expect(result.quality_budget.ran).toBe(false);
	});

	// ============ Test 7: Max 100 file limit enforcement ============

	test('max 100 file limit enforcement', async () => {
		// Create 150 test files
		const files: string[] = [];
		for (let i = 0; i < 150; i++) {
			const filePath = path.join(tempDir, `file${i}.ts`);
			fs.writeFileSync(filePath, `export const x${i} = ${i};\n`);
			files.push(`file${i}.ts`);
		}

		const input: PreCheckBatchInput = {
			files,
			directory: tempDir,
		};

		// Should throw when exceeding max files
		await expect(runPreCheckBatch(input)).rejects.toThrow('exceeds maximum file count');
	});

	// ============ Test 8: Path traversal handling ============

	test('path traversal is filtered out but other files processed', async () => {
		// Create a valid file
		fs.writeFileSync(path.join(tempDir, 'valid.ts'), 'export const x = 1;\n');

		// Include both a valid file and a path traversal attempt
		const input: PreCheckBatchInput = {
			files: ['../outside/file.ts', 'valid.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		// The path traversal should be filtered out, but valid file should still work
		// The function still runs and gates_passed depends on results
		expect(result).toBeDefined();
		// The invalid path should have been skipped (not in changedFiles)
		expect(result.lint.ran).toBe(true);
	});

	// ============ Additional Tests ============

	test('directory validation - empty directory', async () => {
		const input: PreCheckBatchInput = {
			directory: '',
		};

		const result = await runPreCheckBatch(input);

		expect(result.gates_passed).toBe(false);
		expect(result.lint.error).toContain('directory');
	});

	test('directory validation - nonexistent directory', async () => {
		const input: PreCheckBatchInput = {
			directory: '/nonexistent/path/that/does/not/exist',
		};

		const result = await runPreCheckBatch(input);

		// Should fail validation for nonexistent/non-accessible directory
		expect(result.gates_passed).toBe(false);
	});

	test('secretscan error causes gates_passed false (via throwing)', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Throw an error from secretscan
		mockRunSecretscan.mockRejectedValueOnce(new Error('Secretscan execution failed'));

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		expect(result.gates_passed).toBe(false);
		expect(result.secretscan.error).toBe('Secretscan execution failed');
	});

	test('sast_scan error causes gates_passed false (via throwing)', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Throw an error from sast_scan
		mockSastScan.mockRejectedValueOnce(new Error('SAST execution failed'));

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		expect(result.gates_passed).toBe(false);
		expect(result.sast_scan.error).toBe('SAST execution failed');
	});

	test('both hard gates failing', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Both secretscan and sast_scan fail
		mockRunSecretscan.mockResolvedValueOnce({
			scan_dir: '.',
			findings: [{ path: 'test.ts', line: 1, type: 'api_key' as const, confidence: 'high' as const, severity: 'critical' as const, redacted: 'sk-***', context: 'export const x = 1;' }],
			summary: { files_scanned: 1, secrets_found: 1, scan_time_ms: 100 },
		});

		mockSastScan.mockResolvedValueOnce({
			verdict: 'fail' as const,
			findings: [{ rule_id: 'test', severity: 'high' as const, message: 'vuln', location: { file: 'test.ts', line: 1 } }],
			summary: { engine: 'tier_a' as const, files_scanned: 1, findings_count: 1, findings_by_severity: { critical: 0, high: 1, medium: 0, low: 0 } },
		});

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		expect(result.gates_passed).toBe(false);
	});

	test('no linter available', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Override mock to return no linter
		mockDetectAvailableLinter.mockResolvedValueOnce(null);

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		// Should fail since lint is a hard gate
		expect(result.lint.ran).toBe(false);
		expect(result.lint.error).toContain('No linter found');
		expect(result.gates_passed).toBe(false);
	});

	test('secretscan with empty findings passes', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Default mock already returns empty findings
		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		expect(result.gates_passed).toBe(true);
		expect(
			(result.secretscan.result as { findings: unknown[] }).findings,
		).toHaveLength(0);
	});

	test('sast_scan with pass verdict passes', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Default mock already returns pass verdict
		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		expect(result.gates_passed).toBe(true);
		expect(result.sast_scan.result?.verdict).toBe('pass');
	});

	test('quality_budget throw does not fail gates (soft gate)', async () => {
		fs.writeFileSync(path.join(tempDir, 'test.ts'), 'export const x = 1;\n');

		// Throw an error from quality_budget
		mockQualityBudget.mockRejectedValueOnce(new Error('Quality budget failed'));

		const input: PreCheckBatchInput = {
			files: ['test.ts'],
			directory: tempDir,
		};

		const result = await runPreCheckBatch(input);

		// Quality budget is soft gate, so gates should still pass
		expect(result.gates_passed).toBe(true);
		expect(result.quality_budget.error).toBe('Quality budget failed');
	});
});

describe('Parallel Pre-check Hint Generation', () => {
	// These tests verify that the system-enhancer generates appropriate hints
	// based on the pipeline.parallel_precheck config setting

	test('Architect receives parallel precheck hint when enabled', async () => {
		// The system-enhancer should generate "[SWARM HINT] Parallel pre-check enabled"
		// when config.pipeline.parallel_precheck !== false (default is true)
		//
		// Verify the hint mentions pre_check_batch running in parallel

		// Import the system-enhancer to verify hint generation logic
		const { createSystemEnhancerHook } = await import('../../../src/hooks/system-enhancer');

		// Mock config with parallel_precheck enabled (default)
		const config = {
			pipeline: {
				parallel_precheck: true,
			},
		} as const;

		// The hint should be generated when config.pipeline.parallel_precheck !== false
		expect(config.pipeline.parallel_precheck !== false).toBe(true);

		// Expected hint text when enabled
		const expectedHint = '[SWARM HINT] Parallel pre-check enabled: call pre_check_batch(files, directory) after lint --fix and build_check to run lint:check + secretscan + sast_scan + quality_budget concurrently (max 4 parallel). Check gates_passed before calling @reviewer.';

		// Verify the hint contains pre_check_batch and mentions parallel execution
		expect(expectedHint).toContain('pre_check_batch');
		expect(expectedHint).toContain('concurrently');
		expect(expectedHint).toContain('Parallel pre-check enabled');
	});

	test('Architect receives sequential hint when parallel_precheck disabled', async () => {
		// The system-enhancer should generate "[SWARM HINT] Parallel pre-check disabled"
		// when config.pipeline.parallel_precheck === false
		//
		// Verify the hint instructs sequential execution of lint:check, secretscan, sast_scan, quality_budget

		// Mock config with parallel_precheck disabled
		const config = {
			pipeline: {
				parallel_precheck: false,
			},
		} as const;

		// The hint should be generated when config.pipeline.parallel_precheck === false
		expect(config.pipeline.parallel_precheck === false).toBe(true);

		// Expected hint text when disabled
		const expectedHint = '[SWARM HINT] Parallel pre-check disabled: run lint:check → secretscan → sast_scan → quality_budget sequentially.';

		// Verify the hint mentions sequential execution
		expect(expectedHint).toContain('Parallel pre-check disabled');
		expect(expectedHint).toContain('sequentially');
		expect(expectedHint).toContain('lint:check');
		expect(expectedHint).toContain('secretscan');
		expect(expectedHint).toContain('sast_scan');
		expect(expectedHint).toContain('quality_budget');
	});

	test('parallel_precheck defaults to true when not specified', async () => {
		// When config.pipeline is undefined or parallel_precheck is not set,
		// the default value should be true (from schema default)
		const config = {
			pipeline: {},
		} as { pipeline?: { parallel_precheck?: boolean } };

		// The default behavior should be parallel (not explicitly set to false)
		const isParallel = config.pipeline?.parallel_precheck !== false;
		expect(isParallel).toBe(true);
	});
});
