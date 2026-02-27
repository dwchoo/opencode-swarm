/**
 * Handles the /swarm-reset command.
 * Clears plan.md and context.md from .swarm/ directory.
 * Requires --confirm flag as a safety gate.
 */
export declare function handleResetCommand(directory: string, args: string[]): Promise<string>;
