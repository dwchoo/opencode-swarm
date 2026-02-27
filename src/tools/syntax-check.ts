import * as fs from 'node:fs';
import * as path from 'node:path';

import type { PluginConfig } from '../config';
import type { EvidenceVerdict } from '../config/evidence-schema';
import { saveEvidence } from '../evidence/manager';
import { getLanguageForExtension, getParserForFile } from '../lang/registry';
import type { Parser } from '../lang/runtime';

export interface SyntaxCheckInput {
	/** Files to check (from diff gate) */
	changed_files: Array<{ path: string; additions: number }>;
	/** Check mode: 'changed' = only changed files, 'all' = all files in repo */
	mode?: 'changed' | 'all';
	/** Optional: restrict to specific languages */
	languages?: string[];
}

export interface SyntaxCheckFileResult {
	path: string;
	language: string;
	ok: boolean;
	errors: Array<{
		line: number;
		column: number;
		message: string;
	}>;
	skipped_reason?: string;
}

export interface SyntaxCheckResult {
	verdict: EvidenceVerdict;
	files: SyntaxCheckFileResult[];
	summary: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const BINARY_CHECK_BYTES = 8192; // 8KB
const BINARY_NULL_THRESHOLD = 0.1; // 10% null bytes

/**
 * Check if file content appears to be binary
 * Looks for high percentage of null bytes in first 8KB
 */
function isBinaryContent(content: string): boolean {
	const sample = content.slice(0, BINARY_CHECK_BYTES);
	if (sample.length === 0) {
		return false;
	}

	let nullCount = 0;
	for (let i = 0; i < sample.length; i++) {
		if (sample.charCodeAt(i) === 0) {
			nullCount++;
		}
	}
	return nullCount / BINARY_CHECK_BYTES > BINARY_NULL_THRESHOLD;
}

/**
 * Check if target path is inside base path
 */
function isPathInside(basePath: string, targetPath: string): boolean {
	const relative = path.relative(basePath, targetPath);
	return (
		relative === '' ||
		(!relative.startsWith('..') && !path.isAbsolute(relative))
	);
}

/**
 * Extract syntax errors from parse tree
 * Returns empty array if parse succeeds with no errors
 */
function extractSyntaxErrors(
	parser: Parser,
	content: string,
): Array<{ line: number; column: number; message: string }> {
	const tree = parser.parse(content);
	if (!tree) {
		return [];
	}

	const errors: Array<{ line: number; column: number; message: string }> = [];

	// Walk the tree to find ERROR nodes
	function walkNode(node: any) {
		if (node.type === 'ERROR' || node.isMissing === true) {
			errors.push({
				line: node.startPosition.row + 1, // 1-indexed
				column: node.startPosition.column,
				message: 'Syntax error',
			});
		}
		for (const child of node.children) {
			walkNode(child);
		}
	}

	walkNode(tree.rootNode);
	if (errors.length === 0 && tree.rootNode.hasError === true) {
		errors.push({
			line: 1,
			column: 0,
			message: 'Syntax error',
		});
	}
	tree.delete();

	return errors;
}

/**
 * Run syntax check on changed files
 *
 * Respects config.gates.syntax_check.enabled - returns skipped if disabled
 */
export async function syntaxCheck(
	input: SyntaxCheckInput,
	directory: string,
	config?: PluginConfig,
): Promise<SyntaxCheckResult> {
	// Check feature flag
	if (config?.gates?.syntax_check?.enabled === false) {
		return {
			verdict: 'pass', // 'pass' to not block, but log skipped
			files: [],
			summary: 'syntax_check disabled by configuration',
		};
	}

	const { changed_files, mode = 'changed', languages } = input;

	// Filter files
	let filesToCheck = changed_files;

	// In 'changed' mode, filter to additions > 0
	if (mode === 'changed') {
		filesToCheck = filesToCheck.filter((f) => f.additions > 0);
	}

	// Optional: filter by language
	if (languages?.length) {
		const normalizedLanguages = new Set(languages.map((l) => l.toLowerCase()));
		filesToCheck = filesToCheck.filter((file) =>
			(() => {
				const lowerPath = file.path.toLowerCase();
				const ext = path.extname(file.path).toLowerCase();
				const languageId = getLanguageForExtension(ext)?.id.toLowerCase();

				return Array.from(normalizedLanguages).some((lang) => {
					if (languageId && languageId === lang) {
						return true;
					}
					return lowerPath.includes(lang);
				});
			})(),
		);
	}

	const results: SyntaxCheckFileResult[] = [];
	let filesChecked = 0;
	let filesFailed = 0;
	let skippedCount = 0;

	const resolvedDirectory = path.resolve(directory);
	const canonicalDirectory = (() => {
		try {
			return fs.realpathSync(resolvedDirectory);
		} catch {
			return resolvedDirectory;
		}
	})();

	for (const fileInfo of filesToCheck) {
		const { path: filePath } = fileInfo;
		const resolvedPath = path.isAbsolute(filePath)
			? path.resolve(filePath)
			: path.resolve(directory, filePath);

		const result: SyntaxCheckFileResult = {
			path: filePath,
			language: '',
			ok: false,
			errors: [],
		};

		try {
			if (!isPathInside(resolvedDirectory, resolvedPath)) {
				result.skipped_reason = 'path_outside_directory';
				skippedCount++;
				filesFailed++;
				results.push(result);
				continue;
			}

			let canonicalPath: string;
			try {
				canonicalPath = fs.realpathSync(resolvedPath);
			} catch {
				result.skipped_reason = 'file_read_error';
				skippedCount++;
				filesFailed++;
				results.push(result);
				continue;
			}

			if (!isPathInside(canonicalDirectory, canonicalPath)) {
				result.skipped_reason = 'path_outside_directory';
				skippedCount++;
				filesFailed++;
				results.push(result);
				continue;
			}

			let stats: fs.Stats;
			try {
				stats = fs.statSync(canonicalPath);
			} catch {
				result.skipped_reason = 'file_read_error';
				skippedCount++;
				filesFailed++;
				results.push(result);
				continue;
			}

			if (!stats.isFile()) {
				result.skipped_reason = 'file_read_error';
				skippedCount++;
				filesFailed++;
				results.push(result);
				continue;
			}

			if (stats.size > MAX_FILE_SIZE) {
				result.skipped_reason = 'file_too_large';
				skippedCount++;
				results.push(result);
				continue;
			}

			// Read file content
			let content: string;
			try {
				content = fs.readFileSync(canonicalPath, 'utf8');
			} catch {
				result.skipped_reason = 'file_read_error';
				skippedCount++;
				filesFailed++;
				results.push(result);
				continue;
			}

			// Check for binary content
			if (isBinaryContent(content)) {
				result.skipped_reason = 'binary_file';
				skippedCount++;
				results.push(result);
				continue;
			}

			// Get parser for file after content checks
			const parser = await getParserForFile(filePath);

			if (!parser) {
				result.skipped_reason = 'unsupported_language';
				skippedCount++;
				results.push(result);
				continue;
			}

			// Extract language from extension
			const ext = path.extname(filePath).toLowerCase();
			const langDef = getLanguageForExtension(ext);
			result.language = langDef?.id || 'unknown';

			// Parse and extract errors
			const errors = extractSyntaxErrors(parser, content);

			if (errors.length > 0) {
				result.ok = false;
				result.errors = errors;
				filesFailed++;
			} else {
				result.ok = true;
			}
		} catch (error) {
			result.skipped_reason =
				error instanceof Error ? error.message : 'unknown_error';
			skippedCount++;
			filesFailed++;
		}

		results.push(result);
		filesChecked++;
	}

	const verdict: EvidenceVerdict = filesFailed > 0 ? 'fail' : 'pass';

	const summary =
		filesFailed > 0
			? `Syntax errors found in ${filesFailed} of ${filesChecked} files`
			: `All ${filesChecked} files passed syntax check`;

	// Save evidence
	await saveEvidence(directory, 'syntax_check', {
		task_id: 'syntax_check',
		type: 'syntax',
		timestamp: new Date().toISOString(),
		agent: 'syntax_check',
		verdict,
		summary,
		files_checked: filesChecked,
		files_failed: filesFailed,
		skipped_count: skippedCount,
		files: results,
	});

	return {
		verdict,
		files: results,
		summary,
	};
}
