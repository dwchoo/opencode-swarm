/**
 * Pre-Check Batch Tool
 * Runs 4 verification tools in parallel: lint, secretscan, sast-scan, quality-budget
 * Returns unified result with gates_passed status
 */
import { tool } from '@opencode-ai/plugin';
import type { PluginConfig } from '../config';
import type { LintResult } from './lint';
import type { QualityBudgetResult } from './quality-budget';
import type { SastScanResult } from './sast-scan';
import type { SecretscanErrorResult, SecretscanResult } from './secretscan';
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
/**
 * Run all 4 pre-check tools in parallel with concurrency limit
 */
export declare function runPreCheckBatch(input: PreCheckBatchInput): Promise<PreCheckBatchResult>;
/**
 * Pre-check batch tool - runs 4 verification tools in parallel
 * Returns unified result with gates_passed status
 */
export declare const pre_check_batch: ReturnType<typeof tool>;
