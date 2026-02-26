import type { AgentDefinition } from '../agents';
import { loadPluginConfig } from '../config/loader';
import { GuardrailsConfigSchema } from '../config/schema';
import { handleAgentsCommand } from './agents';
import { handleArchiveCommand } from './archive';
import { handleBenchmarkCommand } from './benchmark';
import { handleConfigCommand } from './config';
import { handleDiagnoseCommand } from './diagnose';
import { handleDoctorCommand } from './doctor';
import {
	handleEvidenceCommand,
	handleEvidenceSummaryCommand,
} from './evidence';
import { handleExportCommand } from './export';
import { handleHistoryCommand } from './history';
import { handlePlanCommand } from './plan';
import { handlePreflightCommand } from './preflight';
import {
	LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY,
	normalizeLegacySwarmPhraseForLookup,
	SWARM_COMMAND_ORDER,
	SWARM_COMMAND_REGISTRY,
	type SwarmCommandKey,
} from './registry';
import { handleResetCommand } from './reset';
import { handleRetrieveCommand } from './retrieve';
import { handleStatusCommand } from './status';
import { handleSyncPlanCommand } from './sync-plan';

// Re-export individual handlers
export { handleAgentsCommand } from './agents';
export { handleArchiveCommand } from './archive';
export { handleBenchmarkCommand } from './benchmark';
export { handleConfigCommand } from './config';
export { handleDiagnoseCommand } from './diagnose';
export { handleDoctorCommand } from './doctor';
export { handleEvidenceCommand } from './evidence';
export { handleExportCommand } from './export';
export { handleHistoryCommand } from './history';
export { handlePlanCommand } from './plan';
export { handlePreflightCommand } from './preflight';
export { handleResetCommand } from './reset';
export { handleRetrieveCommand } from './retrieve';
export { handleStatusCommand } from './status';
export { handleSyncPlanCommand } from './sync-plan';

const HELP_TEXT = [
	'## Swarm Commands',
	'',
	'Use canonical `/swarm-*` commands:',
	...SWARM_COMMAND_ORDER.map(
		(key) => `- \`${SWARM_COMMAND_REGISTRY[key].usage}\``,
	),
].join('\n');

const LEGACY_REMOVAL_HEADER =
	'The `/swarm` command was removed. Use canonical `/swarm-*` commands instead.';

const LEGACY_NORMALIZED_PHRASE_ENTRIES = Object.entries(
	LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY,
)
	.map(([legacyPhrase, canonicalCommand]) => ({
		normalizedPhrase: normalizeLegacySwarmPhraseForLookup(legacyPhrase),
		canonicalCommand,
	}))
	.sort(
		(a, b) =>
			b.normalizedPhrase.length - a.normalizedPhrase.length ||
			a.normalizedPhrase.localeCompare(b.normalizedPhrase),
	);

function findLegacyCanonicalReplacement(
	legacyArguments: string,
): SwarmCommandKey | undefined {
	const rawArguments = legacyArguments.trim().toLowerCase().replace(/^\/+/, '');
	if (rawArguments.length === 0) {
		return undefined;
	}

	const rawTokens = rawArguments.split(/\s+/).filter(Boolean);
	if (rawTokens.length === 0) {
		return undefined;
	}

	const normalizedTokenGroups = rawTokens.map((token) =>
		normalizeLegacySwarmPhraseForLookup(token).split(' ').filter(Boolean),
	);
	const normalizedTokens = normalizedTokenGroups.flat();
	if (normalizedTokens.length === 0) {
		return undefined;
	}

	const phraseBoundaryTokenCounts = new Set<number>();
	let cumulativeTokenCount = 0;
	for (const tokenGroup of normalizedTokenGroups) {
		cumulativeTokenCount += tokenGroup.length;
		phraseBoundaryTokenCounts.add(cumulativeTokenCount);
	}

	for (const legacyPhraseEntry of LEGACY_NORMALIZED_PHRASE_ENTRIES) {
		const legacyPhraseTokens = legacyPhraseEntry.normalizedPhrase.split(' ');
		if (normalizedTokens.length < legacyPhraseTokens.length) {
			continue;
		}

		if (!phraseBoundaryTokenCounts.has(legacyPhraseTokens.length)) {
			continue;
		}

		const phraseMatches = legacyPhraseTokens.every(
			(token, index) => normalizedTokens[index] === token,
		);
		if (phraseMatches) {
			return legacyPhraseEntry.canonicalCommand;
		}
	}

	return undefined;
}

function getLegacyRemovalGuidance(legacyArguments: string): string {
	const replacementCommand = findLegacyCanonicalReplacement(legacyArguments);
	if (!replacementCommand) {
		return [
			LEGACY_REMOVAL_HEADER,
			'',
			'Run one of these commands:',
			...SWARM_COMMAND_ORDER.map(
				(key) => `- \`${SWARM_COMMAND_REGISTRY[key].usage}\``,
			),
		].join('\n');
	}

	return [
		LEGACY_REMOVAL_HEADER,
		'',
		`Use \`${SWARM_COMMAND_REGISTRY[replacementCommand].usage}\` for this request.`,
	].join('\n');
}

/**
 * Creates a command.execute.before handler for /swarm commands.
 * Uses factory pattern to close over directory and agents.
 */
export function createSwarmCommandHandler(
	directory: string,
	agents: Record<string, AgentDefinition>,
): (
	input: { command: string; sessionID: string; arguments: string },
	output: { parts: unknown[] },
) => Promise<void> {
	return async (input, output) => {
		if (input.command === 'swarm') {
			output.parts = [
				{
					type: 'text',
					text: getLegacyRemovalGuidance(input.arguments),
				} as unknown as (typeof output.parts)[number],
			];
			return;
		}

		if (!(input.command in SWARM_COMMAND_REGISTRY)) {
			return;
		}

		const canonicalCommand = input.command as SwarmCommandKey;

		// Parse arguments
		const tokens = input.arguments.trim().split(/\s+/).filter(Boolean);
		const args = tokens;

		let text: string;

		switch (canonicalCommand) {
			case 'swarm-status':
				text = await handleStatusCommand(directory, agents);
				break;
			case 'swarm-plan':
				text = await handlePlanCommand(directory, args);
				break;
			case 'swarm-agents': {
				// Load guardrails config for profile display
				const pluginConfig = loadPluginConfig(directory);
				const guardrailsConfig = pluginConfig?.guardrails
					? GuardrailsConfigSchema.parse(pluginConfig.guardrails)
					: undefined;
				text = handleAgentsCommand(agents, guardrailsConfig);
				break;
			}
			case 'swarm-archive':
				text = await handleArchiveCommand(directory, args);
				break;
			case 'swarm-history':
				text = await handleHistoryCommand(directory, args);
				break;
			case 'swarm-config':
				text = await handleConfigCommand(directory, args);
				break;
			case 'swarm-config-doctor':
			case 'swarm-doctor':
				text = await handleDoctorCommand(directory, args);
				break;
			case 'swarm-evidence':
				text = await handleEvidenceCommand(directory, args);
				break;
			case 'swarm-evidence-summary':
				text = await handleEvidenceSummaryCommand(directory);
				break;
			case 'swarm-diagnose':
				text = await handleDiagnoseCommand(directory, args);
				break;
			case 'swarm-preflight':
				text = await handlePreflightCommand(directory, args);
				break;
			case 'swarm-sync-plan':
				text = await handleSyncPlanCommand(directory, args);
				break;
			case 'swarm-benchmark':
				text = await handleBenchmarkCommand(directory, args);
				break;
			case 'swarm-export':
				text = await handleExportCommand(directory, args);
				break;
			case 'swarm-reset':
				text = await handleResetCommand(directory, args);
				break;
			case 'swarm-retrieve':
				text = await handleRetrieveCommand(directory, args);
				break;
			default:
				text = HELP_TEXT;
				break;
		}

		// Convert string result to Part[]
		output.parts = [
			{ type: 'text', text } as unknown as (typeof output.parts)[number],
		];
	};
}
