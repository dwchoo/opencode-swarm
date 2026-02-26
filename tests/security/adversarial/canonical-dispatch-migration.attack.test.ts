import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentDefinition } from '../../../src/agents';
import { createSwarmCommandHandler } from '../../../src/commands';
import {
	SWARM_COMMAND_ORDER,
	SWARM_COMMAND_REGISTRY,
} from '../../../src/commands/registry';
import OpenCodeSwarm from '../../../src/index';

const LEGACY_REMOVAL_HEADER =
	'The `/swarm` command was removed. Use canonical `/swarm-*` commands instead.';

describe('adversarial security: canonical dispatch migration', () => {
	const testAgents: Record<string, AgentDefinition> = {
		architect: {
			name: 'architect',
			config: { model: 'gpt-4.1', temperature: 0.1 },
		},
	};

	let tempDir: string;
	let handler: ReturnType<typeof createSwarmCommandHandler>;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'swarm-canonical-dispatch-attack-'),
		);
		handler = createSwarmCommandHandler(tempDir, testAgents);
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('malformed canonical-like command tokens do not dispatch handlers', async () => {
		const malformedTokens = [
			'swarm-status-now',
			'swarm-status/',
			'/swarm-status',
			'swarm-status\u0000',
			'swarm\u2010status',
			'swarm_status',
		];

		for (const token of malformedTokens) {
			const output = {
				parts: [{ type: 'text', text: 'unchanged' }] as unknown[],
			};

			await handler({ command: token, sessionID: 's-malformed', arguments: '' }, output);

			expect(output.parts).toEqual([{ type: 'text', text: 'unchanged' }]);
		}
	});

	test('legacy path cannot be used to bypass into canonical handler execution', async () => {
		const bypassPayloads = [
			'agents',
			'swarm-agents',
			'/swarm-agents',
			'agents /swarm-agents',
			'agents && swarm-agents',
		];

		for (const payload of bypassPayloads) {
			const output = { parts: [] as unknown[] };

			await handler({ command: 'swarm', sessionID: 's-legacy-bypass', arguments: payload }, output);

			expect(output.parts).toHaveLength(1);
			const text = (output.parts[0] as { text: string }).text;
			expect(text).toContain(LEGACY_REMOVAL_HEADER);
			expect(text).not.toContain('## Available Agents');
			expect(text).not.toContain('architect');
		}
	});

	test('prefix and substring confusion in legacy arguments does not resolve to specific rewrite', async () => {
		const confusingArguments = [
			'status-now',
			'preflighted',
			'swarm statusx',
			'sync planner',
			'retrieved',
		];

		for (const args of confusingArguments) {
			const output = { parts: [] as unknown[] };

			await handler({ command: 'swarm', sessionID: 's-prefix', arguments: args }, output);

			const text = (output.parts[0] as { text: string }).text;
			expect(text).toContain(LEGACY_REMOVAL_HEADER);
			expect(text).toContain('Run one of these commands:');
			expect(text).not.toContain('for this request.');
		}
	});

	test('unicode and separator abuse in legacy args does not trigger canonical replacement lookup', async () => {
		const unicodePayloads = [
			'ѕwarm status',
			'swarm stаtus',
			'swarm\u200B status',
			'／swarm status',
			'swarm status\u0000',
		];

		for (const payload of unicodePayloads) {
			const output = { parts: [] as unknown[] };

			await handler({ command: 'swarm', sessionID: 's-unicode', arguments: payload }, output);

			const text = (output.parts[0] as { text: string }).text;
			expect(text).toContain(LEGACY_REMOVAL_HEADER);
			expect(text).toContain('Run one of these commands:');
			expect(text).not.toContain('for this request.');
		}
	});

	test('legacy alias returns deterministic canonical rewrite guidance only', async () => {
		const output = { parts: [] as unknown[] };

		await handler({ command: 'swarm', sessionID: 's-deterministic', arguments: 'status --json' }, output);

		expect(output.parts).toHaveLength(1);
		expect((output.parts[0] as { text: string }).text).toBe(
			[
				LEGACY_REMOVAL_HEADER,
				'',
				`Use \`${SWARM_COMMAND_REGISTRY['swarm-status'].usage}\` for this request.`,
			].join('\n'),
		);
	});

	test('plugin command registration does not preserve legacy /swarm key from preloaded config', async () => {
		const plugin = await OpenCodeSwarm({ directory: tempDir } as never);
		const opencodeConfig: Record<string, unknown> = {
			command: {
				swarm: {
					template: '$ARGUMENTS',
					description: 'legacy command should not survive merge',
				},
				'swarm-status-now': {
					template: '$ARGUMENTS',
					description: 'non-canonical prefixed command should stay isolated',
				},
			},
		};

		await plugin.config?.(opencodeConfig);

		const commands = opencodeConfig.command as Record<string, unknown>;
		expect(commands.swarm).toBeUndefined();

		for (const key of SWARM_COMMAND_ORDER) {
			expect(commands[key]).toBeDefined();
		}
		expect(commands['swarm-status-now']).toBeDefined();
	});
});
