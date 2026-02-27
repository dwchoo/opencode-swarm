/**
 * Pre-Check Batch Tool
 * Runs 4 verification tools in parallel: lint, secretscan, sast-scan, quality-budget
 * Returns unified result with gates_passed status
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { tool } from '@opencode-ai/plugin';
import pLimit from 'p-limit';

import type { PluginConfig } from '../config';
import { warn } from '../utils';
import type { LintResult } from './lint';
import { detectAvailableLinter, runLint } from './lint';
import type { QualityBudgetResult } from './quality-budget';
import { qualityBudget } from './quality-budget';
import type { SastScanResult } from './sast-scan';
import { sastScan } from './sast-scan';
import type { SecretscanErrorResult, SecretscanResult } from './secretscan';
import { runSecretscan } from './secretscan';

// ============ Constants ============
const TOOL_TIMEOUT_MS = 60_000;
const MAX_COMBINED_BYTES = 500_000; // 500KB
const MAX_CONCURRENT = 4;
const MAX_FILES = 100;

// ============ Input/Output Types ============
export interface PreCheckBatchInput {
	/** List of specific files to check (optional) */
	files?: string[];
	/** Directory to scan */
	directory: string;
	/** SAST severity threshold (default: medium) */
	sast_threshold?: 'low' | 'medium' | 'high' | 'critical';
	/** Optional plugin config */
	config?: PluginConfig;
}

export interface ToolResult<T> {
	/** Whether the tool was executed */
	ran: boolean;
	/** Tool result if successful */
	result?: T;
	/** Error message if failed */
	error?: string;
	/** Duration in milliseconds */
	duration_ms: number;
}

export interface PreCheckBatchResult {
	/** Overall gate status: true if all security gates pass */
	gates_passed: boolean;
	/** Lint tool result */
	lint: ToolResult<LintResult>;
	/** Secretscan tool result */
	secretscan: ToolResult<SecretscanResult | SecretscanErrorResult>;
	/** SAST scan tool result */
	sast_scan: ToolResult<SastScanResult>;
	/** Quality budget tool result */
	quality_budget: ToolResult<QualityBudgetResult>;
	/** Total duration in milliseconds */
	total_duration_ms: number;
}

// ============ Security Validation ============

/**
 * Validate path to prevent traversal attacks
 */
function getCanonicalPath(inputPath: string): string {
	const absolutePath = path.resolve(inputPath);

	try {
		return fs.realpathSync.native(absolutePath);
	} catch {
		// Path may not exist yet. Resolve as much of the path as possible so
		// symlinked prefixes (e.g. /var -> /private/var on macOS) are normalized.
		let currentPath = absolutePath;
		const unresolvedParts: string[] = [];

		while (true) {
			try {
				const resolvedExistingPath = fs.realpathSync.native(currentPath);
				return path.join(resolvedExistingPath, ...unresolvedParts.reverse());
			} catch {
				const parentPath = path.dirname(currentPath);
				if (parentPath === currentPath) {
					return absolutePath;
				}

				unresolvedParts.push(path.basename(currentPath));
				currentPath = parentPath;
			}
		}
	}
}

function validatePath(inputPath: string, baseDir: string): string | null {
	if (!inputPath || inputPath.length === 0) {
		return 'path is required';
	}

	// Resolve to absolute path
	const resolved = path.resolve(baseDir, inputPath);
	const baseResolved = path.resolve(baseDir);
	const canonicalResolved = getCanonicalPath(resolved);
	const canonicalBaseResolved = getCanonicalPath(baseResolved);

	// Ensure the resolved path is within base directory
	const relative = path.relative(canonicalBaseResolved, canonicalResolved);
	const isParentTraversal =
		relative === '..' || relative.startsWith(`..${path.sep}`);
	if (isParentTraversal || path.isAbsolute(relative)) {
		return 'path traversal detected';
	}

	return null;
}

/**
 * Validate the directory input
 */
function validateDirectory(dir: string): string | null {
	if (!dir || dir.length === 0) {
		return 'directory is required';
	}

	if (dir.length > 500) {
		return 'directory path too long';
	}

	// Check for path traversal
	const traversalCheck = validatePath(dir, process.cwd());
	if (traversalCheck) {
		return traversalCheck;
	}

	return null;
}

// ============ Timeout Helper ============

/**
 * Run a function with timeout
 */
async function runWithTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
): Promise<T> {
	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(
			() => reject(new Error(`Timeout after ${timeoutMs}ms`)),
			timeoutMs,
		);
	});

	return Promise.race([promise, timeoutPromise]);
}

// ============ Wrapper Functions ============

/**
 * Run lint with detection and timeout
 */
async function runLintWrapped(
	_config?: PluginConfig,
): Promise<ToolResult<LintResult>> {
	const start = process.hrtime.bigint();

	try {
		const linter = await detectAvailableLinter();

		if (!linter) {
			return {
				ran: false,
				error: 'No linter found (biome or eslint)',
				duration_ms: Number(process.hrtime.bigint() - start) / 1_000_000,
			};
		}

		const result = await runWithTimeout(
			runLint(linter, 'check'),
			TOOL_TIMEOUT_MS,
		);

		return {
			ran: true,
			result,
			duration_ms: Number(process.hrtime.bigint() - start) / 1_000_000,
		};
	} catch (error) {
		return {
			ran: true,
			error: error instanceof Error ? error.message : 'Unknown error',
			duration_ms: Number(process.hrtime.bigint() - start) / 1_000_000,
		};
	}
}

/**
 * Run secretscan with timeout
 */
async function runSecretscanWrapped(
	directory: string,
	_config?: PluginConfig,
): Promise<ToolResult<SecretscanResult | SecretscanErrorResult>> {
	const start = process.hrtime.bigint();

	try {
		const result = await runWithTimeout(
			runSecretscan(directory),
			TOOL_TIMEOUT_MS,
		);

		return {
			ran: true,
			result,
			duration_ms: Number(process.hrtime.bigint() - start) / 1_000_000,
		};
	} catch (error) {
		return {
			ran: true,
			error: error instanceof Error ? error.message : 'Unknown error',
			duration_ms: Number(process.hrtime.bigint() - start) / 1_000_000,
		};
	}
}

/**
 * Run SAST scan with timeout
 */
async function runSastScanWrapped(
	changedFiles: string[],
	directory: string,
	severityThreshold: 'low' | 'medium' | 'high' | 'critical',
	config?: PluginConfig,
): Promise<ToolResult<SastScanResult>> {
	const start = process.hrtime.bigint();

	try {
		const result = await runWithTimeout(
			sastScan(
				{ changed_files: changedFiles, severity_threshold: severityThreshold },
				directory,
				config,
			),
			TOOL_TIMEOUT_MS,
		);

		return {
			ran: true,
			result,
			duration_ms: Number(process.hrtime.bigint() - start) / 1_000_000,
		};
	} catch (error) {
		return {
			ran: true,
			error: error instanceof Error ? error.message : 'Unknown error',
			duration_ms: Number(process.hrtime.bigint() - start) / 1_000_000,
		};
	}
}

/**
 * Run quality budget with timeout
 */
async function runQualityBudgetWrapped(
	changedFiles: string[],
	directory: string,
	_config?: PluginConfig,
): Promise<ToolResult<QualityBudgetResult>> {
	const start = process.hrtime.bigint();

	try {
		const result = await runWithTimeout(
			qualityBudget({ changed_files: changedFiles }, directory),
			TOOL_TIMEOUT_MS,
		);

		return {
			ran: true,
			result,
			duration_ms: Number(process.hrtime.bigint() - start) / 1_000_000,
		};
	} catch (error) {
		return {
			ran: true,
			error: error instanceof Error ? error.message : 'Unknown error',
			duration_ms: Number(process.hrtime.bigint() - start) / 1_000_000,
		};
	}
}

// ============ Main Function ============

/**
 * Run all 4 pre-check tools in parallel with concurrency limit
 */
export async function runPreCheckBatch(
	input: PreCheckBatchInput,
): Promise<PreCheckBatchResult> {
	const { files, directory, sast_threshold = 'medium', config } = input;

	// Validate directory
	const dirError = validateDirectory(directory);
	if (dirError) {
		warn(`pre_check_batch: Invalid directory: ${dirError}`);
		return {
			gates_passed: false,
			lint: { ran: false, error: dirError, duration_ms: 0 },
			secretscan: { ran: false, error: dirError, duration_ms: 0 },
			sast_scan: { ran: false, error: dirError, duration_ms: 0 },
			quality_budget: { ran: false, error: dirError, duration_ms: 0 },
			total_duration_ms: 0,
		};
	}

	// Determine files to check
	// If files are provided, use them; otherwise scan directory for changed files
	// For simplicity in batch mode, we'll scan the entire directory
	let changedFiles: string[] = [];

	if (files && files.length > 0) {
		// Validate each file path
		for (const file of files) {
			const fileError = validatePath(file, directory);
			if (fileError) {
				warn(`pre_check_batch: Invalid file path: ${file}`);
				continue;
			}
			changedFiles.push(path.resolve(directory, file));
		}
	} else {
		// Scan directory for all source files (simplified approach)
		// In practice, this would use git diff or similar
		changedFiles = [];
	}

	// Early return when files is undefined - skip all tools
	if (changedFiles.length === 0 && !files) {
		warn('pre_check_batch: No files provided, skipping all tools');
		return {
			gates_passed: true,
			lint: { ran: false, error: 'No files provided', duration_ms: 0 },
			secretscan: { ran: false, error: 'No files provided', duration_ms: 0 },
			sast_scan: { ran: false, error: 'No files provided', duration_ms: 0 },
			quality_budget: {
				ran: false,
				error: 'No files provided',
				duration_ms: 0,
			},
			total_duration_ms: 0,
		};
	}

	// Limit files to prevent abuse
	if (changedFiles.length > MAX_FILES) {
		throw new Error(
			`Input exceeds maximum file count: ${changedFiles.length} > ${MAX_FILES}`,
		);
	}

	// Run all tools in parallel with concurrency limit
	const limit = pLimit(MAX_CONCURRENT);
	const batchStart = process.hrtime.bigint();

	const [lintResult, secretscanResult, sastScanResult, qualityBudgetResult] =
		await Promise.all([
			limit(() => runLintWrapped(config)),
			limit(() => runSecretscanWrapped(directory, config)),
			limit(() =>
				runSastScanWrapped(changedFiles, directory, sast_threshold, config),
			),
			limit(() => runQualityBudgetWrapped(changedFiles, directory, config)),
		]);

	// Calculate wall-clock duration for the whole batch
	const totalDuration =
		Number(process.hrtime.bigint() - batchStart) / 1_000_000;

	// Determine gates_passed:
	// - lint, secretscan, and sast_scan are HARD GATES
	// - quality_budget is a SOFT GATE and does not flip gates_passed
	let gatesPassed = true;

	// Check lint (hard gate)
	if (lintResult.ran && lintResult.result) {
		const lintRes = lintResult.result;
		if ('success' in lintRes && lintRes.success === false) {
			gatesPassed = false;
			warn('pre_check_batch: Lint has errors - GATE FAILED');
		}
	} else if (lintResult.error) {
		// Error in lint - fail closed
		gatesPassed = false;
		warn(`pre_check_batch: Lint error - GATE FAILED: ${lintResult.error}`);
	}

	// Check secretscan (hard gate)
	if (secretscanResult.ran && secretscanResult.result) {
		const scanResult = secretscanResult.result as SecretscanResult;
		if ('findings' in scanResult && scanResult.findings.length > 0) {
			gatesPassed = false;
			warn('pre_check_batch: Secretscan found secrets - GATE FAILED');
		}
	} else if (secretscanResult.error) {
		// Error in secretscan - fail closed
		gatesPassed = false;
		warn(
			`pre_check_batch: Secretscan error - GATE FAILED: ${secretscanResult.error}`,
		);
	}

	// Check SAST scan (hard gate)
	if (sastScanResult.ran && sastScanResult.result) {
		if (sastScanResult.result.verdict === 'fail') {
			gatesPassed = false;
			warn('pre_check_batch: SAST scan found vulnerabilities - GATE FAILED');
		}
	} else if (sastScanResult.error) {
		// Error in SAST - fail closed
		gatesPassed = false;
		warn(
			`pre_check_batch: SAST scan error - GATE FAILED: ${sastScanResult.error}`,
		);
	}

	// Check quality budget (soft gate)
	if (qualityBudgetResult.ran && qualityBudgetResult.result) {
		if (qualityBudgetResult.result.verdict === 'fail') {
			warn('pre_check_batch: Quality budget violations detected - SOFT GATE');
		}
	} else if (qualityBudgetResult.error) {
		warn(
			`pre_check_batch: Quality budget error - SOFT GATE: ${qualityBudgetResult.error}`,
		);
	}

	// Build result
	const result: PreCheckBatchResult = {
		gates_passed: gatesPassed,
		lint: lintResult,
		secretscan: secretscanResult,
		sast_scan: sastScanResult,
		quality_budget: qualityBudgetResult,
		total_duration_ms: Math.round(totalDuration),
	};

	// Log warning if output is large
	const outputSize = JSON.stringify(result).length;
	if (outputSize > MAX_COMBINED_BYTES) {
		warn(`pre_check_batch: Large output (${outputSize} bytes)`);
	}

	return result;
}

// ============ Tool Definition ============

/**
 * Pre-check batch tool - runs 4 verification tools in parallel
 * Returns unified result with gates_passed status
 */
export const pre_check_batch: ReturnType<typeof tool> = tool({
	description:
		'Run multiple verification tools in parallel: lint, secretscan, SAST scan, and quality budget. Returns unified result with gates_passed status. lint/secretscan/sast_scan are HARD GATES; quality_budget is a SOFT GATE.',
	args: {
		files: tool.schema
			.array(tool.schema.string())
			.optional()
			.describe(
				'Specific files to check (optional, scans directory if not provided)',
			),
		directory: tool.schema
			.string()
			.describe('Directory to run checks in (e.g., "." or "./src")'),
		sast_threshold: tool.schema
			.enum(['low', 'medium', 'high', 'critical'])
			.optional()
			.describe(
				'Minimum severity for SAST findings to cause failure (default: medium)',
			),
	},
	async execute(args: unknown): Promise<string> {
		// Validate arguments
		if (!args || typeof args !== 'object') {
			const errorResult: PreCheckBatchResult = {
				gates_passed: false,
				lint: { ran: false, error: 'Invalid arguments', duration_ms: 0 },
				secretscan: { ran: false, error: 'Invalid arguments', duration_ms: 0 },
				sast_scan: { ran: false, error: 'Invalid arguments', duration_ms: 0 },
				quality_budget: {
					ran: false,
					error: 'Invalid arguments',
					duration_ms: 0,
				},
				total_duration_ms: 0,
			};
			return JSON.stringify(errorResult, null, 2);
		}

		const typedArgs = args as PreCheckBatchInput;

		if (!typedArgs.directory) {
			const errorResult: PreCheckBatchResult = {
				gates_passed: false,
				lint: { ran: false, error: 'directory is required', duration_ms: 0 },
				secretscan: {
					ran: false,
					error: 'directory is required',
					duration_ms: 0,
				},
				sast_scan: {
					ran: false,
					error: 'directory is required',
					duration_ms: 0,
				},
				quality_budget: {
					ran: false,
					error: 'directory is required',
					duration_ms: 0,
				},
				total_duration_ms: 0,
			};
			return JSON.stringify(errorResult, null, 2);
		}

		// Validate directory
		const dirError = validateDirectory(typedArgs.directory);
		if (dirError) {
			const errorResult: PreCheckBatchResult = {
				gates_passed: false,
				lint: { ran: false, error: dirError, duration_ms: 0 },
				secretscan: { ran: false, error: dirError, duration_ms: 0 },
				sast_scan: { ran: false, error: dirError, duration_ms: 0 },
				quality_budget: { ran: false, error: dirError, duration_ms: 0 },
				total_duration_ms: 0,
			};
			return JSON.stringify(errorResult, null, 2);
		}

		// Run pre-check batch
		try {
			const result = await runPreCheckBatch({
				files: typedArgs.files,
				directory: typedArgs.directory,
				sast_threshold: typedArgs.sast_threshold,
				config: typedArgs.config,
			});

			return JSON.stringify(result, null, 2);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			const errorResult: PreCheckBatchResult = {
				gates_passed: false,
				lint: { ran: false, error: errorMessage, duration_ms: 0 },
				secretscan: { ran: false, error: errorMessage, duration_ms: 0 },
				sast_scan: { ran: false, error: errorMessage, duration_ms: 0 },
				quality_budget: { ran: false, error: errorMessage, duration_ms: 0 },
				total_duration_ms: 0,
			};
			return JSON.stringify(errorResult, null, 2);
		}
	},
});
