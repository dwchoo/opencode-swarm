import { z } from 'zod';

// File size limits for evidence bundles
export const EVIDENCE_MAX_JSON_BYTES = 500 * 1024; // 500KB
export const EVIDENCE_MAX_PATCH_BYTES = 5 * 1024 * 1024; // 5MB
export const EVIDENCE_MAX_TASK_BYTES = 20 * 1024 * 1024; // 20MB

// Evidence type enum
export const EvidenceTypeSchema = z.enum([
	'review',
	'test',
	'diff',
	'approval',
	'note',
	'retrospective',
	'syntax',
	'placeholder',
	'sast',
	'sbom',
	'build',
	'quality_budget',
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

// Evidence verdict enum
export const EvidenceVerdictSchema = z.enum([
	'pass',
	'fail',
	'approved',
	'rejected',
	'info',
]);
export type EvidenceVerdict = z.infer<typeof EvidenceVerdictSchema>;

// Base evidence schema with common fields
export const BaseEvidenceSchema = z.object({
	task_id: z.string().min(1), // e.g. "1.1", "2.3"
	type: EvidenceTypeSchema,
	timestamp: z.string().datetime(), // ISO 8601
	agent: z.string().min(1), // which agent produced this
	verdict: EvidenceVerdictSchema,
	summary: z.string().min(1), // human-readable summary
	metadata: z.record(z.string(), z.unknown()).optional(), // extensible key-value
});
export type BaseEvidence = z.infer<typeof BaseEvidenceSchema>;

// Review evidence schema
export const ReviewEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('review'),
	risk: z.enum(['low', 'medium', 'high', 'critical']),
	issues: z
		.array(
			z.object({
				severity: z.enum(['error', 'warning', 'info']),
				message: z.string().min(1),
				file: z.string().optional(),
				line: z.number().int().optional(),
			}),
		)
		.default([]),
});
export type ReviewEvidence = z.infer<typeof ReviewEvidenceSchema>;

// Test evidence schema
export const TestEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('test'),
	tests_passed: z.number().int().min(0),
	tests_failed: z.number().int().min(0),
	test_file: z.string().optional(), // path to test file
	failures: z
		.array(
			z.object({
				name: z.string().min(1),
				message: z.string().min(1),
			}),
		)
		.default([]),
});
export type TestEvidence = z.infer<typeof TestEvidenceSchema>;

// Diff evidence schema
export const DiffEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('diff'),
	files_changed: z.array(z.string()).default([]),
	additions: z.number().int().min(0).default(0),
	deletions: z.number().int().min(0).default(0),
	patch_path: z.string().optional(), // path to .patch file
});
export type DiffEvidence = z.infer<typeof DiffEvidenceSchema>;

// Approval evidence schema (base with narrowed type)
export const ApprovalEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('approval'),
});
export type ApprovalEvidence = z.infer<typeof ApprovalEvidenceSchema>;

// Note evidence schema (base with narrowed type)
export const NoteEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('note'),
});
export type NoteEvidence = z.infer<typeof NoteEvidenceSchema>;

// Retrospective evidence schema
export const RetrospectiveEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('retrospective'),
	// Execution metrics
	phase_number: z.number().int().min(0),
	total_tool_calls: z.number().int().min(0),
	// Revision cycles
	coder_revisions: z.number().int().min(0),
	reviewer_rejections: z.number().int().min(0),
	test_failures: z.number().int().min(0),
	security_findings: z.number().int().min(0),
	integration_issues: z.number().int().min(0),
	// Task classification
	task_count: z.number().int().min(1),
	task_complexity: z.enum(['trivial', 'simple', 'moderate', 'complex']),
	// Qualitative findings (structured)
	top_rejection_reasons: z.array(z.string()).default([]),
	lessons_learned: z.array(z.string()).max(5).default([]),
});
export type RetrospectiveEvidence = z.infer<typeof RetrospectiveEvidenceSchema>;

export const SyntaxEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('syntax'),
	files_checked: z.number().int(),
	files_failed: z.number().int(),
	skipped_count: z.number().int().default(0),
	files: z
		.array(
			z.object({
				path: z.string(),
				language: z.string(),
				ok: z.boolean(),
				errors: z
					.array(
						z.object({
							line: z.number().int(),
							column: z.number().int(),
							message: z.string(),
						}),
					)
					.default([]),
				skipped_reason: z.string().optional(),
			}),
		)
		.default([]),
});
export type SyntaxEvidence = z.infer<typeof SyntaxEvidenceSchema>;

export const PlaceholderEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('placeholder'),
	details: z.record(z.string(), z.unknown()).optional(),
});
export type PlaceholderEvidence = z.infer<typeof PlaceholderEvidenceSchema>;

export const SastEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('sast'),
	details: z.record(z.string(), z.unknown()).optional(),
});
export type SastEvidence = z.infer<typeof SastEvidenceSchema>;

export const SbomEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('sbom'),
	details: z.record(z.string(), z.unknown()).optional(),
});
export type SbomEvidence = z.infer<typeof SbomEvidenceSchema>;

export const BuildEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('build'),
	details: z.record(z.string(), z.unknown()).optional(),
});
export type BuildEvidence = z.infer<typeof BuildEvidenceSchema>;

export const QualityBudgetEvidenceSchema = BaseEvidenceSchema.extend({
	type: z.literal('quality_budget'),
	details: z.record(z.string(), z.unknown()).optional(),
});
export type QualityBudgetEvidence = z.infer<typeof QualityBudgetEvidenceSchema>;

// Discriminated union of all evidence types
export const EvidenceSchema = z.discriminatedUnion('type', [
	ReviewEvidenceSchema,
	TestEvidenceSchema,
	DiffEvidenceSchema,
	ApprovalEvidenceSchema,
	NoteEvidenceSchema,
	RetrospectiveEvidenceSchema,
	SyntaxEvidenceSchema,
	PlaceholderEvidenceSchema,
	SastEvidenceSchema,
	SbomEvidenceSchema,
	BuildEvidenceSchema,
	QualityBudgetEvidenceSchema,
]);
export type Evidence = z.infer<typeof EvidenceSchema>;

// Evidence bundle schema (container for all evidence for a task)
export const EvidenceBundleSchema = z.object({
	schema_version: z.literal('1.0.0'),
	task_id: z.string().min(1),
	entries: z.array(EvidenceSchema).default([]),
	created_at: z.string().datetime(),
	updated_at: z.string().datetime(),
});
export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
