import * as fs from 'node:fs';
import { validateSwarmPath } from '../hooks/utils';

/**
 * Handles the /swarm-reset command.
 * Clears plan.md and context.md from .swarm/ directory.
 * Requires --confirm flag as a safety gate.
 */
export async function handleResetCommand(
	directory: string,
	args: string[],
): Promise<string> {
	const hasConfirm = args.includes('--confirm');

	if (!hasConfirm) {
		return [
			'## Swarm Reset',
			'',
			'⚠️ This will delete plan.md and context.md from .swarm/',
			'',
			'**Tip**: Run `/swarm-export` first to backup your state.',
			'',
			'To confirm, run: `/swarm-reset --confirm`',
		].join('\n');
	}

	const filesToReset = ['plan.md', 'context.md'];
	const results: string[] = [];

	for (const filename of filesToReset) {
		try {
			const resolvedPath = validateSwarmPath(directory, filename);
			if (fs.existsSync(resolvedPath)) {
				fs.unlinkSync(resolvedPath);
				results.push(`- ✅ Deleted ${filename}`);
			} else {
				results.push(`- ⏭️ ${filename} not found (skipped)`);
			}
		} catch {
			results.push(`- ❌ Failed to delete ${filename}`);
		}
	}

	// Clean up summaries directory
	try {
		const summariesPath = validateSwarmPath(directory, 'summaries');
		if (fs.existsSync(summariesPath)) {
			fs.rmSync(summariesPath, { recursive: true, force: true });
			results.push('- ✅ Deleted summaries/ directory');
		} else {
			results.push('- ⏭️ summaries/ not found (skipped)');
		}
	} catch {
		results.push('- ❌ Failed to delete summaries/');
	}

	return [
		'## Swarm Reset Complete',
		'',
		...results,
		'',
		'Swarm state has been cleared. Start fresh with a new plan.',
	].join('\n');
}
