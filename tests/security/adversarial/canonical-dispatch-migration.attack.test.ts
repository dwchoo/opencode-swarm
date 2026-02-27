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

const RESET_MISSING_CONFIRM_MESSAGE =
	SWARM_COMMAND_REGISTRY['swarm-reset'].required?.missingArgsMessage;
const RETRIEVE_MISSING_ARG_MESSAGE =
	SWARM_COMMAND_REGISTRY['swarm-retrieve'].required?.missingArgsMessage;

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
			'swarm-status /swarm-agents',
			'swarm-status\nswarm-agents',
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

	test('leading slash floods are normalized but remain in deterministic dispatch lanes', async () => {
		const legacyVariants = ['/swarm', '//swarm', '////swarm'];

		for (const command of legacyVariants) {
			const output = { parts: [] as unknown[] };

			await handler(
				{ command, sessionID: 's-legacy-slash-flood', arguments: 'agents' },
				output,
			);

			expect(output.parts).toHaveLength(1);
			const text = (output.parts[0] as { text: string }).text;
			expect(text).toContain(LEGACY_REMOVAL_HEADER);
			expect(text).toContain('Use `/swarm-agents` for this request.');
			expect(text).not.toContain('## Available Agents');
		}

		const canonicalVariants = ['/swarm-agents', '//swarm-agents', '////swarm-agents'];

		for (const command of canonicalVariants) {
			const output = { parts: [] as unknown[] };

			await handler(
				{ command, sessionID: 's-canonical-slash-flood', arguments: '' },
				output,
			);

			expect(output.parts).toHaveLength(1);
			const text = (output.parts[0] as { text: string }).text;
			expect(text).toContain('## Registered Agents');
			expect(text).toContain('architect');
			expect(text).not.toContain(LEGACY_REMOVAL_HEADER);
		}
	});

	test('legacy path cannot be used to bypass into canonical handler execution', async () => {
		const bypassPayloads = [
			'agents',
			'swarm-agents',
			'/swarm-agents',
			'agents /swarm-agents',
			'agents && swarm-agents',
			'reset --confirm',
			'retrieve S1',
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

	test('canonical dispatch ignores command-token injection with inline arguments', async () => {
		const output = {
			parts: [{ type: 'text', text: 'unchanged' }] as unknown[],
		};

		await handler(
			{
				command: 'swarm-reset --confirm',
				sessionID: 's-inline-command-injection',
				arguments: '',
			},
			output,
		);

		expect(output.parts).toEqual([{ type: 'text', text: 'unchanged' }]);
	});

	test('swarm-reset guardrail resists end-of-flags bypass payloads', async () => {
		const output = { parts: [] as unknown[] };

		await handler(
			{
				command: 'swarm-reset',
				sessionID: 's-reset-bypass',
				arguments: '-- --confirm',
			},
			output,
		);

		expect(output.parts).toHaveLength(1);
		expect((output.parts[0] as { text: string }).text).toBe(
			RESET_MISSING_CONFIRM_MESSAGE,
		);
	});

	test('swarm-retrieve guardrail resists flag-shaped positional bypass payloads', async () => {
		const payloads = ['-S1', '--id=S1'];

		for (const argumentsValue of payloads) {
			const output = { parts: [] as unknown[] };

			await handler(
				{
					command: 'swarm-retrieve',
					sessionID: 's-retrieve-bypass',
					arguments: argumentsValue,
				},
				output,
			);

			expect(output.parts).toHaveLength(1);
			expect((output.parts[0] as { text: string }).text).toBe(
				RETRIEVE_MISSING_ARG_MESSAGE,
			);
		}
	});

	test('prefix and substring confusion in legacy arguments does not resolve to specific rewrite', async () => {
		const confusingArguments = [
			'status-now',
			'preflighted',
			'swarm statusx',
			'sw arm status',
			'swarm stat us',
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

	test('slash-heavy legacy args can only produce guidance text and never command execution', async () => {
		const slashPayloads = ['/status', '//status', '///status', '/swarm status'];

		for (const payload of slashPayloads) {
			const output = { parts: [] as unknown[] };

			await handler(
				{ command: 'swarm', sessionID: 's-legacy-slash-args', arguments: payload },
				output,
			);

			expect(output.parts).toHaveLength(1);
			const text = (output.parts[0] as { text: string }).text;
			expect(text).toContain(LEGACY_REMOVAL_HEADER);
			expect(text).toContain('Use `/swarm-status` for this request.');
			expect(text).not.toContain('## Available Agents');
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

	test('canonical template registration resists slash-prefixed shadow entries', async () => {
		const plugin = await OpenCodeSwarm({ directory: tempDir } as never);
		const opencodeConfig: Record<string, unknown> = {
			command: {
				swarm: {
					template: '$ARGUMENTS',
					description: 'legacy command should be removed',
				},
				'/swarm-status': {
					template: 'shadow-template',
					description: 'slash-prefixed shadow key',
				},
				'swarm-status': {
					template: 'tampered-template',
					description: 'attempt to overwrite canonical template',
				},
			},
		};

		await plugin.config?.(opencodeConfig);

		const commands = opencodeConfig.command as Record<string, unknown>;
		expect(commands.swarm).toBeUndefined();
		expect(commands['/swarm-status']).toEqual({
			template: 'shadow-template',
			description: 'slash-prefixed shadow key',
		});
		expect(commands['swarm-status']).toEqual({
			template: 'swarm-status $ARGUMENTS',
			description: 'Show current swarm plan status and active phase.',
		});
	});
});
