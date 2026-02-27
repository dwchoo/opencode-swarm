import { tool } from '@opencode-ai/plugin';
export interface BuildCommand {
    ecosystem: string;
    command: string;
    cwd: string;
    priority: number;
}
export interface BuildDiscoveryResult {
    commands: BuildCommand[];
    skipped: {
        ecosystem: string;
        reason: string;
    }[];
}
export interface BuildDiscoveryOptions {
    scope?: 'changed' | 'all';
    changedFiles?: string[];
}
/**
 * Check if a command exists on PATH
 * Uses 'where' on Windows, 'which' on Unix
 */
export declare function isCommandAvailable(command: string): boolean;
/**
 * Discover build commands for a given working directory
 */
export declare function discoverBuildCommands(workingDir: string, options?: BuildDiscoveryOptions): Promise<BuildDiscoveryResult>;
/**
 * Clear the toolchain cache (useful for testing)
 */
export declare function clearToolchainCache(): void;
/**
 * Get ecosystem info for display
 */
export declare function getEcosystems(): string[];
export declare const build_discovery: ReturnType<typeof tool>;
