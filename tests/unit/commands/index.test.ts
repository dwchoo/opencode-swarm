import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentDefinition } from '../../../src/agents';
import { createSwarmCommandHandler } from '../../../src/commands/index';
import { SWARM_COMMAND_ORDER, SWARM_COMMAND_REGISTRY } from '../../../src/commands/registry';
import OpenCodeSwarm from '../../../src/index';

const LEGACY_REMOVAL_HEADER =
	'The `/swarm` command was removed. Use canonical `/swarm-*` commands instead.';

const RETRIEVE_MISSING_ARG_MESSAGE = [
	'## Swarm Retrieve',
	'',
	'Usage: `/swarm-retrieve <id>`',
	'',
	'Example: `/swarm-retrieve S1`',
	'',
	'Retrieves the full output that was replaced by a summary.',
].join('\n');

const RESET_MISSING_CONFIRM_MESSAGE = [
	'## Swarm Reset',
	'',
	'⚠️ This will delete plan.md and context.md from .swarm/',
	'',
	'**Tip**: Run `/swarm-export` first to backup your state.',
	'',
	'To confirm, run: `/swarm-reset --confirm`',
].join('\n');

describe('canonical dispatch migration verification', () => {
	const testAgents: Record<string, AgentDefinition> = {
		architect: {
			name: 'architect',
			config: { model: 'gpt-4.1', temperature: 0.1 },
		},
	};

	let tempDir: string;
	let handler: ReturnType<typeof createSwarmCommandHandler>;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-canonical-dispatch-'));
		handler = createSwarmCommandHandler(tempDir, testAgents);
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('executes canonical /swarm-* command tokens (happy path)', async () => {
		const output = { parts: [] as unknown[] };

		await handler({ command: 'swarm-agents', sessionID: 's1', arguments: '' }, output);

		expect(output.parts).toHaveLength(1);
		const part = output.parts[0] as { type: string; text: string };
		expect(part.type).toBe('text');
		expect(part.text).toContain('architect');
		expect(part.text).not.toContain(LEGACY_REMOVAL_HEADER);
	});

	test('guards swarm-retrieve when required positional argument is missing', async () => {
		const output = { parts: [] as unknown[] };

		await handler({ command: 'swarm-retrieve', sessionID: 's1', arguments: '' }, output);

		expect(output.parts).toHaveLength(1);
		expect((output.parts[0] as { text: string }).text).toBe(
			RETRIEVE_MISSING_ARG_MESSAGE,
		);
	});

	test('guards swarm-retrieve when only flags are provided', async () => {
		const output = { parts: [] as unknown[] };

		await handler(
			{ command: 'swarm-retrieve', sessionID: 's1', arguments: '--foo' },
			output,
		);

		expect(output.parts).toHaveLength(1);
		expect((output.parts[0] as { text: string }).text).toBe(
			RETRIEVE_MISSING_ARG_MESSAGE,
		);
	});

	test('guards normalized /swarm-retrieve command token when required positional argument is missing', async () => {
		const output = { parts: [] as unknown[] };

		await handler(
			{ command: '/swarm-retrieve', sessionID: 's1', arguments: '' },
			output,
		);

		expect(output.parts).toHaveLength(1);
		expect((output.parts[0] as { text: string }).text).toBe(
			RETRIEVE_MISSING_ARG_MESSAGE,
		);
	});

	test('counts positional args after -- for swarm-retrieve and reaches handler path', async () => {
		const output = { parts: [] as unknown[] };

		await handler(
			{ command: 'swarm-retrieve', sessionID: 's1', arguments: '-- --foo' },
			output,
		);

		expect(output.parts).toHaveLength(1);
		const text = (output.parts[0] as { text: string }).text;
		expect(text).toContain('## Retrieve Failed');
		expect(text).toContain('Invalid summary ID');
		expect(text).not.toBe(RETRIEVE_MISSING_ARG_MESSAGE);
	});

	test('guards swarm-reset when required --confirm flag is missing', async () => {
		const noArgsOutput = { parts: [] as unknown[] };

		await handler({ command: 'swarm-reset', sessionID: 's1', arguments: '' }, noArgsOutput);

		expect(noArgsOutput.parts).toHaveLength(1);
		expect((noArgsOutput.parts[0] as { text: string }).text).toBe(
			RESET_MISSING_CONFIRM_MESSAGE,
		);

		const positionalOnlyOutput = { parts: [] as unknown[] };

		await handler(
			{ command: 'swarm-reset', sessionID: 's1', arguments: 'foo' },
			positionalOnlyOutput,
		);

		expect(positionalOnlyOutput.parts).toHaveLength(1);
		expect((positionalOnlyOutput.parts[0] as { text: string }).text).toBe(
			RESET_MISSING_CONFIRM_MESSAGE,
		);
	});

	test('swarm-reset with --confirm reaches handler path', async () => {
		const output = { parts: [] as unknown[] };

		await handler(
			{ command: 'swarm-reset', sessionID: 's1', arguments: '--confirm' },
			output,
		);

		expect(output.parts).toHaveLength(1);
		expect((output.parts[0] as { text: string }).text).toContain(
			'## Swarm Reset Complete',
		);
	});

	test('required-flag guard accepts --flag=value tokens before -- boundary', async () => {
		const output = { parts: [] as unknown[] };
		const statusEntry = SWARM_COMMAND_REGISTRY['swarm-status'];
		const originalRequired = statusEntry.required;
		statusEntry.required = {
			requiredFlags: ['--confirm'],
			usage: '/swarm-status --confirm',
			example: '/swarm-status --confirm',
		};

		try {
			await handler(
				{
					command: 'swarm-status',
					sessionID: 's1',
					arguments: '--confirm=yes',
				},
				output,
			);

			expect(output.parts).toHaveLength(1);
			expect((output.parts[0] as { text: string }).text).toContain(
				'No active swarm plan found.',
			);
			expect((output.parts[0] as { text: string }).text).not.toContain(
				'Missing required argument(s).',
			);
		} finally {
			statusEntry.required = originalRequired;
		}
	});

	test('required-flag guard ignores flag=value tokens after -- boundary', async () => {
		const output = { parts: [] as unknown[] };
		const missingMessage = 'MISSING CONFIRM FROM GUARD';
		const statusEntry = SWARM_COMMAND_REGISTRY['swarm-status'];
		const originalRequired = statusEntry.required;
		statusEntry.required = {
			requiredFlags: ['--confirm'],
			missingArgsMessage: missingMessage,
			usage: '/swarm-status --confirm',
			example: '/swarm-status --confirm',
		};

		try {
			await handler(
				{
					command: 'swarm-status',
					sessionID: 's1',
					arguments: '-- --confirm=yes',
				},
				output,
			);

			expect(output.parts).toHaveLength(1);
			expect((output.parts[0] as { text: string }).text).toBe(missingMessage);
		} finally {
			statusEntry.required = originalRequired;
		}
	});

	test('swarm-retrieve treats lone - token as positional argument', async () => {
		const output = { parts: [] as unknown[] };

		await handler(
			{ command: 'swarm-retrieve', sessionID: 's1', arguments: '-' },
			output,
		);

		expect(output.parts).toHaveLength(1);
		const text = (output.parts[0] as { text: string }).text;
		expect(text).toContain('## Retrieve Failed');
		expect(text).toContain('Invalid summary ID');
		expect(text).not.toBe(RETRIEVE_MISSING_ARG_MESSAGE);
	});

	test('swarm-retrieve requires positional token after -- boundary', async () => {
		const output = { parts: [] as unknown[] };

		await handler(
			{ command: 'swarm-retrieve', sessionID: 's1', arguments: '--' },
			output,
		);

		expect(output.parts).toHaveLength(1);
		expect((output.parts[0] as { text: string }).text).toBe(
			RETRIEVE_MISSING_ARG_MESSAGE,
		);
	});

	test('status and agents remain unaffected without required-argument guardrails', async () => {
		const statusOutput = { parts: [] as unknown[] };
		await handler({ command: 'swarm-status', sessionID: 's1', arguments: '' }, statusOutput);

		expect(statusOutput.parts).toHaveLength(1);
		expect((statusOutput.parts[0] as { text: string }).text).not.toContain(
			'Missing required argument(s).',
		);

		const agentsOutput = { parts: [] as unknown[] };
		await handler({ command: 'swarm-agents', sessionID: 's1', arguments: '' }, agentsOutput);

		expect(agentsOutput.parts).toHaveLength(1);
		expect((agentsOutput.parts[0] as { text: string }).text).toContain('architect');
	});

	test('returns deterministic removal guidance for legacy /swarm status', async () => {
		const output = { parts: [] as unknown[] };

		await handler({ command: 'swarm', sessionID: 's1', arguments: 'status' }, output);

		expect(output.parts).toHaveLength(1);
		const part = output.parts[0] as { type: string; text: string };
		expect(part.type).toBe('text');
		expect(part.text).toBe(
			[
				LEGACY_REMOVAL_HEADER,
				'',
				`Use \`${SWARM_COMMAND_REGISTRY['swarm-status'].usage}\` for this request.`,
			].join('\n'),
		);
	});

	test('returns full canonical command list for unknown/empty legacy /swarm args (edge cases)', async () => {
		const expectedFullGuidance = [
			LEGACY_REMOVAL_HEADER,
			'',
			'Run one of these commands:',
			...SWARM_COMMAND_ORDER.map(
				(key) => `- \`${SWARM_COMMAND_REGISTRY[key].usage}\``,
			),
		].join('\n');

		const unknownOutput = { parts: [] as unknown[] };
		await handler(
			{ command: 'swarm', sessionID: 's1', arguments: 'does-not-exist' },
			unknownOutput,
		);

		expect(unknownOutput.parts).toHaveLength(1);
		expect((unknownOutput.parts[0] as { text: string }).text).toBe(
			expectedFullGuidance,
		);

		const emptyOutput = { parts: [] as unknown[] };
		await handler({ command: 'swarm', sessionID: 's1', arguments: '   ' }, emptyOutput);

		expect(emptyOutput.parts).toHaveLength(1);
		expect((emptyOutput.parts[0] as { text: string }).text).toBe(
			expectedFullGuidance,
		);

		const slashOnlyOutput = { parts: [] as unknown[] };
		await handler({ command: 'swarm', sessionID: 's1', arguments: '////' }, slashOnlyOutput);

		expect(slashOnlyOutput.parts).toHaveLength(1);
		expect((slashOnlyOutput.parts[0] as { text: string }).text).toBe(
			expectedFullGuidance,
		);

		const normalizedEmptyTokenOutput = { parts: [] as unknown[] };
		await handler(
			{ command: 'swarm', sessionID: 's1', arguments: '_-' },
			normalizedEmptyTokenOutput,
		);

		expect(normalizedEmptyTokenOutput.parts).toHaveLength(1);
		expect((normalizedEmptyTokenOutput.parts[0] as { text: string }).text).toBe(
			expectedFullGuidance,
		);
	});

	test('unknown canonical-like command token is ignored without mutating output', async () => {
		const output = { parts: [{ type: 'text', text: 'unchanged' }] as unknown[] };

		await handler(
			{ command: 'swarm-unknown', sessionID: 's1', arguments: 'status' },
			output,
		);

		expect(output.parts).toEqual([{ type: 'text', text: 'unchanged' }]);
	});

	test('normalizes command token whitespace/slashes and handles empty normalized command (edge cases)', async () => {
		const legacyOutput = { parts: [] as unknown[] };
		await handler(
			{ command: '   ///swarm   ', sessionID: 's1', arguments: 'status' },
			legacyOutput,
		);

		expect(legacyOutput.parts).toHaveLength(1);
		expect((legacyOutput.parts[0] as { text: string }).text).toContain(
			'Use `/swarm-status` for this request.',
		);

		const canonicalOutput = { parts: [] as unknown[] };
		await handler(
			{ command: '  ///swarm-agents  ', sessionID: 's1', arguments: '' },
			canonicalOutput,
		);

		expect(canonicalOutput.parts).toHaveLength(1);
		expect((canonicalOutput.parts[0] as { text: string }).text).toContain(
			'architect',
		);

		const emptyNormalizedOutput = {
			parts: [{ type: 'text', text: 'unchanged' }] as unknown[],
		};
		await handler(
			{ command: '   ////   ', sessionID: 's1', arguments: 'status' },
			emptyNormalizedOutput,
		);

		expect(emptyNormalizedOutput.parts).toEqual([
			{ type: 'text', text: 'unchanged' },
		]);
	});

	test('legacy /swarm guidance-only path does not execute handlers', async () => {
		const output = { parts: [] as unknown[] };

		await handler({ command: 'swarm', sessionID: 's1', arguments: 'agents' }, output);

		expect(output.parts).toHaveLength(1);
		const text = (output.parts[0] as { text: string }).text;
		expect(text).toContain(LEGACY_REMOVAL_HEADER);
		expect(text).toContain('Use `/swarm-agents` for this request.');
		expect(text).not.toContain('## Available Agents');
	});

	test('plugin config registers canonical commands and removes root /swarm registration', async () => {
		const plugin = await OpenCodeSwarm({ directory: tempDir } as never);
		const opencodeConfig: Record<string, unknown> = {
			command: {
				existing: {
					template: '$ARGUMENTS',
					description: 'Existing command remains',
				},
			},
		};

		await plugin.config?.(opencodeConfig);

		const commandConfig = opencodeConfig.command as Record<string, unknown>;
		expect(commandConfig.existing).toBeDefined();
		expect(commandConfig.swarm).toBeUndefined();

		for (const key of SWARM_COMMAND_ORDER) {
			expect(commandConfig[key]).toBeDefined();
		}
	});

	test('plugin config merges into existing agent/command objects deterministically', async () => {
		const plugin = await OpenCodeSwarm({ directory: tempDir } as never);
		const legacyAgent = {
			model: 'legacy-model',
			temperature: 0.7,
		};
		const opencodeConfig: Record<string, unknown> = {
			agent: {
				architect: legacyAgent,
				legacy: legacyAgent,
			},
			command: {
				swarm: {
					template: '$ARGUMENTS',
					description: 'legacy root command to remove',
				},
				'swarm-status': {
					template: 'legacy template',
					description: 'legacy canonical entry should be replaced',
				},
				custom: {
					template: '$ARGUMENTS',
					description: 'custom command should remain',
				},
			},
		};

		await plugin.config?.(opencodeConfig);

		const commandConfig = opencodeConfig.command as Record<string, unknown>;
		const agentConfig = opencodeConfig.agent as Record<string, unknown>;

		expect(commandConfig.swarm).toBeUndefined();
		expect(commandConfig.custom).toEqual({
			template: '$ARGUMENTS',
			description: 'custom command should remain',
		});
		expect(commandConfig['swarm-status']).toEqual({
			template: 'swarm-status $ARGUMENTS',
			description: 'Swarm command (/swarm-status)',
		});
		expect(agentConfig.legacy).toBe(legacyAgent);
		expect(agentConfig.architect).not.toBe(legacyAgent);
		expect(agentConfig.architect).toEqual(
			expect.objectContaining({
				mode: 'primary',
			}),
		);

		for (const key of SWARM_COMMAND_ORDER) {
			expect(commandConfig[key]).toBeDefined();
		}
	});

	test('plugin config initializes canonical command map when command config is absent', async () => {
		const plugin = await OpenCodeSwarm({ directory: tempDir } as never);
		const opencodeConfig: Record<string, unknown> = {};

		await plugin.config?.(opencodeConfig);

		const commandConfig = opencodeConfig.command as Record<string, unknown>;
		expect(commandConfig).toBeDefined();
		expect(commandConfig.swarm).toBeUndefined();
		for (const key of SWARM_COMMAND_ORDER) {
			expect(commandConfig[key]).toEqual({
				template: `${key} $ARGUMENTS`,
				description: `Swarm command (${SWARM_COMMAND_REGISTRY[key].usage})`,
			});
		}
	});

	test('plugin config overwrites tampered canonical templates with command-keyed templates', async () => {
		const plugin = await OpenCodeSwarm({ directory: tempDir } as never);
		const opencodeConfig: Record<string, unknown> = {
			command: {
				'swarm-status': {
					template: '$ARGUMENTS',
					description: 'tampered status',
				},
				'swarm-plan': {
					template: '$ARGUMENTS',
					description: 'tampered plan',
				},
			},
		};

		await plugin.config?.(opencodeConfig);

		const commandConfig = opencodeConfig.command as Record<string, unknown>;
		expect(commandConfig['swarm-status']).toEqual({
			template: 'swarm-status $ARGUMENTS',
			description: 'Swarm command (/swarm-status)',
		});
		expect(commandConfig['swarm-plan']).toEqual({
			template: 'swarm-plan $ARGUMENTS',
			description: 'Swarm command (/swarm-plan)',
		});
	});

	test('legacy guidance prefers longest matching phrase for migration rewrites', async () => {
		const output = { parts: [] as unknown[] };

		await handler(
			{
				command: 'swarm',
				sessionID: 's1',
				arguments: 'swarm config doctor --fix',
			},
			output,
		);

		expect(output.parts).toHaveLength(1);
		expect((output.parts[0] as { text: string }).text).toBe(
			[
				LEGACY_REMOVAL_HEADER,
				'',
				`Use \`${SWARM_COMMAND_REGISTRY['swarm-config-doctor'].usage}\` for this request.`,
			].join('\n'),
		);
	});

	test('falls back to canonical help text for registry commands without explicit switch branch', async () => {
		const output = { parts: [] as unknown[] };
		const mutableRegistry = SWARM_COMMAND_REGISTRY as unknown as Record<
			string,
			(typeof SWARM_COMMAND_REGISTRY)[keyof typeof SWARM_COMMAND_REGISTRY]
		>;
		mutableRegistry['swarm-unmapped'] = {
			...SWARM_COMMAND_REGISTRY['swarm-status'],
			usage: '/swarm-status',
		};

		try {
			await handler(
				{ command: 'swarm-unmapped', sessionID: 's1', arguments: '' },
				output,
			);

			expect(output.parts).toHaveLength(1);
			const part = output.parts[0] as { type: string; text: string };
			expect(part.type).toBe('text');
			expect(part.text).toContain('## Swarm Commands');
			expect(part.text).toContain('Use canonical `/swarm-*` commands:');
			expect(part.text).toContain('`/swarm-status`');
		} finally {
			delete mutableRegistry['swarm-unmapped'];
		}
	});
});
