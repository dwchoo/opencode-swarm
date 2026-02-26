import * as fs from 'node:fs';
import * as path from 'node:path';
import { tool } from '@opencode-ai/plugin';

// ============ Constants ============
const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB per evidence file
const MAX_EVIDENCE_FILES = 1000;
const MAX_TOTAL_EVIDENCE_BYTES = 8 * 1024 * 1024; // 8MB total evidence parse budget
const MAX_REQUIRED_TYPES_RAW_LENGTH = 512;
const MAX_REQUIRED_TYPES_TOKENS = 32;
const MAX_REQUIRED_TYPE_TOKEN_LENGTH = 64;
const EVIDENCE_DIR = '.swarm/evidence';
const PLAN_FILE = '.swarm/plan.md';

// Shell metacharacters that are not allowed in required_types
const SHELL_METACHAR_REGEX = /[;&|%$`\\]/;

// Strict evidence filename schema: <major>_<minor>-<type>.json
const EVIDENCE_FILENAME_REGEX = /^(\d+)_(\d+)-([a-z0-9][a-z0-9_-]*)\.json$/;

// ============ Types ============
interface CompletedTask {
	taskId: string;
	taskName: string;
}

interface EvidenceFile {
	taskId: string;
	type: string;
}

interface ParsedEvidenceRecord {
	taskId: string;
	type: string;
}

interface Gap {
	taskId: string;
	taskName: string;
	missing: string[];
	present: string[];
}

interface EvidenceCheckResult {
	completedTasks: CompletedTask[];
	tasksWithFullEvidence: string[];
	completeness: number;
	requiredTypes: string[];
	gaps: Gap[];
}

interface NoTasksResult {
	message: string;
	gaps: [];
	completeness: number;
}

// ============ Validation ============
function containsControlChars(str: string): boolean {
	return /[\0\t\r\n]/.test(str);
}

function validateRequiredTypes(input: string): string | null {
	if (input.length > MAX_REQUIRED_TYPES_RAW_LENGTH) {
		return `required_types exceeds max length (${MAX_REQUIRED_TYPES_RAW_LENGTH})`;
	}
	if (containsControlChars(input)) {
		return 'required_types contains control characters';
	}
	if (SHELL_METACHAR_REGEX.test(input)) {
		return 'required_types contains shell metacharacters (;|&%$`\\)';
	}
	// Only allow alphanumeric, commas, spaces, underscores, hyphens
	if (!/^[a-zA-Z0-9,\s_-]+$/.test(input)) {
		return 'required_types contains invalid characters (only alphanumeric, commas, spaces, underscores, hyphens allowed)';
	}
	return null;
}

function parseRequiredTypes(
	input: string,
): { types: string[] } | { error: string } {
	const tokens = input.split(',');

	if (tokens.length > MAX_REQUIRED_TYPES_TOKENS) {
		return {
			error: `required_types exceeds max token count (${MAX_REQUIRED_TYPES_TOKENS})`,
		};
	}

	const parsed: string[] = [];
	const seen = new Set<string>();

	for (const token of tokens) {
		const trimmed = token.trim();
		if (trimmed.length === 0) {
			return { error: 'required_types contains empty token' };
		}
		if (trimmed.length > MAX_REQUIRED_TYPE_TOKEN_LENGTH) {
			return {
				error: `required_types token exceeds max length (${MAX_REQUIRED_TYPE_TOKEN_LENGTH})`,
			};
		}

		const canonical = trimmed.toLowerCase();
		if (seen.has(canonical)) {
			return { error: `required_types contains duplicate token: ${trimmed}` };
		}

		seen.add(canonical);
		parsed.push(trimmed);
	}

	return { types: parsed };
}

function parseEvidenceFilename(filename: string): ParsedEvidenceRecord | null {
	const match = EVIDENCE_FILENAME_REGEX.exec(filename);
	if (match === null) {
		return null;
	}

	return {
		taskId: `${match[1]}.${match[2]}`,
		type: match[3],
	};
}

// ============ Path Security ============
function isPathWithinBase(targetPath: string, basePath: string): boolean {
	const normalizedBase = path.resolve(basePath);
	const normalizedTarget = path.resolve(targetPath);

	return (
		normalizedTarget === normalizedBase ||
		normalizedTarget.startsWith(`${normalizedBase}${path.sep}`)
	);
}

function isPathWithinSwarm(filePath: string, cwd: string): boolean {
	const normalizedCwd = path.resolve(cwd);
	const swarmPath = path.join(normalizedCwd, '.swarm');
	return isPathWithinBase(filePath, swarmPath);
}

// ============ Plan Parsing ============
function parseCompletedTasks(planContent: string): CompletedTask[] {
	const tasks: CompletedTask[] = [];
	const regex = /^-\s+\[[xX]\]\s+(\d+\.\d+):\s+(.+)/gm;

	while (true) {
		const match = regex.exec(planContent);
		if (match === null) {
			break;
		}

		const taskId = match[1];
		let taskName = match[2].trim();

		// Strip trailing size tags like [SMALL], [MEDIUM], [LARGE]
		taskName = taskName.replace(/\s*\[(SMALL|MEDIUM|LARGE)\]\s*$/i, '').trim();

		tasks.push({ taskId, taskName });
	}

	return tasks;
}

// ============ Evidence Reading ============
function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isReviewEvidenceRecord(parsed: Record<string, unknown>): parsed is {
	task_id: string;
	type: 'review';
	timestamp: string;
	agent: string;
	verdict: string;
	summary: string;
	risk: string;
	issues: unknown[];
} {
	return (
		isNonEmptyString(parsed.task_id) &&
		parsed.type === 'review' &&
		isNonEmptyString(parsed.timestamp) &&
		isNonEmptyString(parsed.agent) &&
		isNonEmptyString(parsed.verdict) &&
		isNonEmptyString(parsed.summary) &&
		isNonEmptyString(parsed.risk) &&
		Array.isArray(parsed.issues)
	);
}

function isTestEvidenceRecord(parsed: Record<string, unknown>): parsed is {
	task_id: string;
	type: 'test';
	timestamp: string;
	agent: string;
	verdict: string;
	summary: string;
	tests_passed: number;
	tests_failed: number;
} {
	return (
		isNonEmptyString(parsed.task_id) &&
		parsed.type === 'test' &&
		isNonEmptyString(parsed.timestamp) &&
		isNonEmptyString(parsed.agent) &&
		isNonEmptyString(parsed.verdict) &&
		isNonEmptyString(parsed.summary) &&
		isNonNegativeInteger(parsed.tests_passed) &&
		isNonNegativeInteger(parsed.tests_failed)
	);
}

function isBaseEvidenceRecord(parsed: Record<string, unknown>): parsed is {
	task_id: string;
	type: string;
} {
	return isNonEmptyString(parsed.task_id) && isNonEmptyString(parsed.type);
}

function hasValidOptionalCommonFields(
	parsed: Record<string, unknown>,
): boolean {
	if (parsed.timestamp !== undefined && !isNonEmptyString(parsed.timestamp)) {
		return false;
	}
	if (parsed.agent !== undefined && !isNonEmptyString(parsed.agent)) {
		return false;
	}
	if (parsed.verdict !== undefined && !isNonEmptyString(parsed.verdict)) {
		return false;
	}
	if (parsed.summary !== undefined && !isNonEmptyString(parsed.summary)) {
		return false;
	}

	return true;
}

function hasValidOptionalTestCounts(parsed: Record<string, unknown>): boolean {
	const hasPassed = parsed.tests_passed !== undefined;
	const hasFailed = parsed.tests_failed !== undefined;

	if (!hasPassed && !hasFailed) {
		return true;
	}

	if (!hasPassed || !hasFailed) {
		return false;
	}

	return (
		isNonNegativeInteger(parsed.tests_passed) &&
		isNonNegativeInteger(parsed.tests_failed)
	);
}

function parseEvidenceRecord(parsed: unknown): ParsedEvidenceRecord | null {
	if (!parsed || typeof parsed !== 'object') {
		return null;
	}

	const parsedObject = parsed as Record<string, unknown>;

	if (!isBaseEvidenceRecord(parsedObject)) {
		return null;
	}

	if (!hasValidOptionalCommonFields(parsedObject)) {
		return null;
	}

	if (isReviewEvidenceRecord(parsedObject)) {
		return {
			taskId: parsedObject.task_id,
			type: parsedObject.type,
		};
	}

	if (isTestEvidenceRecord(parsedObject)) {
		return {
			taskId: parsedObject.task_id,
			type: parsedObject.type,
		};
	}

	if (parsedObject.type === 'review' || parsedObject.type === 'test') {
		if (
			parsedObject.type === 'test' &&
			!hasValidOptionalTestCounts(parsedObject)
		) {
			return null;
		}

		return {
			taskId: parsedObject.task_id,
			type: parsedObject.type,
		};
	}

	return {
		taskId: parsedObject.task_id,
		type: parsedObject.type,
	};
}

function readEvidenceFiles(evidenceDir: string): EvidenceFile[] {
	const evidence: EvidenceFile[] = [];

	// Handle missing evidence directory gracefully
	if (!fs.existsSync(evidenceDir)) {
		return evidence;
	}

	let evidenceDirStat: fs.Stats;
	try {
		evidenceDirStat = fs.statSync(evidenceDir);
	} catch {
		return evidence;
	}

	if (!evidenceDirStat.isDirectory()) {
		return evidence;
	}

	let files: string[];
	try {
		files = fs.readdirSync(evidenceDir);
	} catch {
		return evidence;
	}

	files.sort((a, b) => a.localeCompare(b));

	// Limit number of files to read
	const filesToProcess = files.slice(0, MAX_EVIDENCE_FILES);
	let totalBytesRead = 0;

	for (const filename of filesToProcess) {
		const expectedFromFilename = parseEvidenceFilename(filename);
		if (!expectedFromFilename) {
			continue;
		}

		const filePath = path.join(evidenceDir, filename);
		const evidenceDirResolved = path.resolve(evidenceDir);
		if (!isPathWithinBase(filePath, evidenceDirResolved)) {
			continue;
		}

		let fd: number | null = null;
		try {
			const noFollowFlag =
				typeof fs.constants.O_NOFOLLOW === 'number'
					? fs.constants.O_NOFOLLOW
					: 0;
			fd = fs.openSync(filePath, fs.constants.O_RDONLY | noFollowFlag);

			const stat = fs.fstatSync(fd);
			if (!stat.isFile()) {
				continue;
			}
			if (stat.size > MAX_FILE_SIZE_BYTES) {
				continue;
			}
			if (totalBytesRead + stat.size > MAX_TOTAL_EVIDENCE_BYTES) {
				continue;
			}

			const pathStat = fs.lstatSync(filePath);
			if (pathStat.isSymbolicLink()) {
				continue;
			}
			if (pathStat.dev !== stat.dev || pathStat.ino !== stat.ino) {
				continue;
			}

			const content = fs.readFileSync(fd, 'utf-8');
			totalBytesRead += stat.size;

			let parsed: unknown;
			try {
				parsed = JSON.parse(content);
			} catch {
				continue;
			}

			const parsedEvidence = parseEvidenceRecord(parsed);
			if (!parsedEvidence) {
				continue;
			}

			if (
				parsedEvidence.taskId !== expectedFromFilename.taskId ||
				parsedEvidence.type !== expectedFromFilename.type
			) {
				continue;
			}

			evidence.push({
				taskId: parsedEvidence.taskId,
				type: parsedEvidence.type,
			});
		} catch {
			// Ignore unreadable or race-affected entries and continue.
		} finally {
			if (fd !== null) {
				try {
					fs.closeSync(fd);
				} catch {
					// Ignore close errors and continue processing other files.
				}
			}
		}
	}

	return evidence;
}

// ============ Gap Analysis ============
function analyzeGaps(
	completedTasks: CompletedTask[],
	evidence: EvidenceFile[],
	requiredTypes: string[],
): { tasksWithFullEvidence: string[]; gaps: Gap[] } {
	const tasksWithFullEvidence: string[] = [];
	const gaps: Gap[] = [];

	// Build a map of taskId -> set of evidence types
	const evidenceByTask = new Map<string, Set<string>>();
	for (const ev of evidence) {
		if (!evidenceByTask.has(ev.taskId)) {
			evidenceByTask.set(ev.taskId, new Set());
		}
		evidenceByTask.get(ev.taskId)!.add(ev.type);
	}

	for (const task of completedTasks) {
		const taskEvidence = evidenceByTask.get(task.taskId) || new Set();

		const missing: string[] = [];
		const present: string[] = [];

		for (const reqType of requiredTypes) {
			const reqLower = reqType.toLowerCase();
			const found = [...taskEvidence].some((t) => t.toLowerCase() === reqLower);
			if (found) {
				present.push(reqType);
			} else {
				missing.push(reqType);
			}
		}

		if (missing.length === 0) {
			tasksWithFullEvidence.push(task.taskId);
		} else {
			gaps.push({
				taskId: task.taskId,
				taskName: task.taskName,
				missing,
				present,
			});
		}
	}

	return { tasksWithFullEvidence, gaps };
}

// ============ Tool Definition ============
export const evidence_check: ReturnType<typeof tool> = tool({
	description:
		'Verify completed tasks in the plan have required evidence. Reads .swarm/plan.md for completed tasks and .swarm/evidence/ for evidence files. Returns JSON with completeness ratio and gaps for tasks missing required evidence types.',
	args: {
		required_types: tool.schema
			.string()
			.optional()
			.describe(
				'Comma-separated evidence types required per task (default: "review,test")',
			),
	},
	async execute(args: unknown, _context: unknown): Promise<string> {
		// Safe args extraction
		let requiredTypesInput: string | undefined;
		try {
			if (args && typeof args === 'object') {
				const obj = args as Record<string, unknown>;
				requiredTypesInput =
					typeof obj.required_types === 'string'
						? obj.required_types
						: undefined;
			}
		} catch {
			// Malicious getter threw
		}

		// Get current working directory
		const cwd = process.cwd();

		// Validate required_types (if provided) and preserve secure defaults
		const defaultRequiredTypesValue = 'review,test';
		const requiredTypesValue = requiredTypesInput ?? defaultRequiredTypesValue;
		const validationError = validateRequiredTypes(requiredTypesValue);
		if (validationError) {
			const errorResult = {
				error: `invalid required_types: ${validationError}`,
				completedTasks: [],
				tasksWithFullEvidence: [],
				completeness: 0,
				requiredTypes: [],
				gaps: [],
			};
			return JSON.stringify(errorResult, null, 2);
		}

		const parsedRequiredTypes = parseRequiredTypes(requiredTypesValue);
		if ('error' in parsedRequiredTypes) {
			const errorResult = {
				error: `invalid required_types: ${parsedRequiredTypes.error}`,
				completedTasks: [],
				tasksWithFullEvidence: [],
				completeness: 0,
				requiredTypes: [],
				gaps: [],
			};
			return JSON.stringify(errorResult, null, 2);
		}
		const requiredTypes = parsedRequiredTypes.types;

		// Read plan file
		const planPath = path.join(cwd, PLAN_FILE);

		// Security check: ensure plan path is within .swarm/
		if (!isPathWithinSwarm(planPath, cwd)) {
			const errorResult = {
				error: 'plan file path validation failed',
				completedTasks: [],
				tasksWithFullEvidence: [],
				completeness: 0,
				requiredTypes: [],
				gaps: [],
			};
			return JSON.stringify(errorResult, null, 2);
		}

		let planContent: string;
		try {
			planContent = fs.readFileSync(planPath, 'utf-8');
		} catch {
			// Plan file doesn't exist or can't be read
			const result: NoTasksResult = {
				message: 'No completed tasks found in plan.',
				gaps: [],
				completeness: 1.0,
			};
			return JSON.stringify(result, null, 2);
		}

		// Parse completed tasks
		const completedTasks = parseCompletedTasks(planContent);

		// Handle no completed tasks
		if (completedTasks.length === 0) {
			const result: NoTasksResult = {
				message: 'No completed tasks found in plan.',
				gaps: [],
				completeness: 1.0,
			};
			return JSON.stringify(result, null, 2);
		}

		// Read evidence files
		const evidenceDir = path.join(cwd, EVIDENCE_DIR);

		// Security check: ensure evidence directory path is within .swarm/
		if (!isPathWithinSwarm(evidenceDir, cwd)) {
			const errorResult = {
				error: 'evidence directory path validation failed',
				completedTasks: [],
				tasksWithFullEvidence: [],
				completeness: 0,
				requiredTypes: [],
				gaps: [],
			};
			return JSON.stringify(errorResult, null, 2);
		}

		const evidence = readEvidenceFiles(evidenceDir);

		// Analyze gaps
		const { tasksWithFullEvidence, gaps } = analyzeGaps(
			completedTasks,
			evidence,
			requiredTypes,
		);

		// Calculate completeness ratio
		const completeness =
			completedTasks.length > 0
				? Math.round(
						(tasksWithFullEvidence.length / completedTasks.length) * 100,
					) / 100
				: 1.0;

		const result: EvidenceCheckResult = {
			completedTasks,
			tasksWithFullEvidence,
			completeness,
			requiredTypes,
			gaps,
		};

		return JSON.stringify(result, null, 2);
	},
});
