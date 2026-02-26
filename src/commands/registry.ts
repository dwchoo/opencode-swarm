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
import { handleResetCommand } from './reset';
import { handleRetrieveCommand } from './retrieve';
import { handleStatusCommand } from './status';
import { handleSyncPlanCommand } from './sync-plan';

export const SWARM_COMMAND_ORDER = [
	'swarm-status',
	'swarm-plan',
	'swarm-agents',
	'swarm-history',
	'swarm-config',
	'swarm-config-doctor',
	'swarm-doctor',
	'swarm-evidence',
	'swarm-evidence-summary',
	'swarm-archive',
	'swarm-diagnose',
	'swarm-preflight',
	'swarm-sync-plan',
	'swarm-benchmark',
	'swarm-export',
	'swarm-reset',
	'swarm-retrieve',
] as const;

export type SwarmCommandKey = (typeof SWARM_COMMAND_ORDER)[number];

export type SwarmCommandHandlerRef =
	| typeof handleStatusCommand
	| typeof handlePlanCommand
	| typeof handleAgentsCommand
	| typeof handleHistoryCommand
	| typeof handleConfigCommand
	| typeof handleDoctorCommand
	| typeof handleEvidenceCommand
	| typeof handleEvidenceSummaryCommand
	| typeof handleArchiveCommand
	| typeof handleDiagnoseCommand
	| typeof handlePreflightCommand
	| typeof handleSyncPlanCommand
	| typeof handleBenchmarkCommand
	| typeof handleExportCommand
	| typeof handleResetCommand
	| typeof handleRetrieveCommand;

export type SwarmCommandUsage = `/${SwarmCommandKey}`;

export interface SwarmCommandRegistryEntry {
	handler: SwarmCommandHandlerRef;
	usage: SwarmCommandUsage;
	legacyRewriteHint: string;
}

export const SWARM_COMMAND_REGISTRY: Record<
	SwarmCommandKey,
	SwarmCommandRegistryEntry
> = {
	'swarm-status': {
		handler: handleStatusCommand,
		usage: '/swarm-status',
		legacyRewriteHint: 'Use /swarm-status instead of /swarm status.',
	},
	'swarm-plan': {
		handler: handlePlanCommand,
		usage: '/swarm-plan',
		legacyRewriteHint: 'Use /swarm-plan instead of /swarm plan.',
	},
	'swarm-agents': {
		handler: handleAgentsCommand,
		usage: '/swarm-agents',
		legacyRewriteHint: 'Use /swarm-agents instead of /swarm agents.',
	},
	'swarm-history': {
		handler: handleHistoryCommand,
		usage: '/swarm-history',
		legacyRewriteHint: 'Use /swarm-history instead of /swarm history.',
	},
	'swarm-config': {
		handler: handleConfigCommand,
		usage: '/swarm-config',
		legacyRewriteHint: 'Use /swarm-config instead of /swarm config.',
	},
	'swarm-config-doctor': {
		handler: handleDoctorCommand,
		usage: '/swarm-config-doctor',
		legacyRewriteHint:
			'Use /swarm-config-doctor instead of /swarm config doctor.',
	},
	'swarm-doctor': {
		handler: handleDoctorCommand,
		usage: '/swarm-doctor',
		legacyRewriteHint: 'Use /swarm-doctor instead of /swarm doctor.',
	},
	'swarm-evidence': {
		handler: handleEvidenceCommand,
		usage: '/swarm-evidence',
		legacyRewriteHint: 'Use /swarm-evidence instead of /swarm evidence.',
	},
	'swarm-evidence-summary': {
		handler: handleEvidenceSummaryCommand,
		usage: '/swarm-evidence-summary',
		legacyRewriteHint:
			'Use /swarm-evidence-summary instead of /swarm evidence summary.',
	},
	'swarm-archive': {
		handler: handleArchiveCommand,
		usage: '/swarm-archive',
		legacyRewriteHint: 'Use /swarm-archive instead of /swarm archive.',
	},
	'swarm-diagnose': {
		handler: handleDiagnoseCommand,
		usage: '/swarm-diagnose',
		legacyRewriteHint: 'Use /swarm-diagnose instead of /swarm diagnose.',
	},
	'swarm-preflight': {
		handler: handlePreflightCommand,
		usage: '/swarm-preflight',
		legacyRewriteHint: 'Use /swarm-preflight instead of /swarm preflight.',
	},
	'swarm-sync-plan': {
		handler: handleSyncPlanCommand,
		usage: '/swarm-sync-plan',
		legacyRewriteHint: 'Use /swarm-sync-plan instead of /swarm sync-plan.',
	},
	'swarm-benchmark': {
		handler: handleBenchmarkCommand,
		usage: '/swarm-benchmark',
		legacyRewriteHint: 'Use /swarm-benchmark instead of /swarm benchmark.',
	},
	'swarm-export': {
		handler: handleExportCommand,
		usage: '/swarm-export',
		legacyRewriteHint: 'Use /swarm-export instead of /swarm export.',
	},
	'swarm-reset': {
		handler: handleResetCommand,
		usage: '/swarm-reset',
		legacyRewriteHint: 'Use /swarm-reset instead of /swarm reset.',
	},
	'swarm-retrieve': {
		handler: handleRetrieveCommand,
		usage: '/swarm-retrieve',
		legacyRewriteHint: 'Use /swarm-retrieve instead of /swarm retrieve.',
	},
};

export const SWARM_COMMAND_LIST: ReadonlyArray<SwarmCommandRegistryEntry> =
	SWARM_COMMAND_ORDER.map((key) => SWARM_COMMAND_REGISTRY[key]);

export const SWARM_COMMAND_USAGE_MAP: Record<
	SwarmCommandKey,
	SwarmCommandUsage
> = SWARM_COMMAND_ORDER.reduce(
	(acc, key) => {
		acc[key] = SWARM_COMMAND_REGISTRY[key].usage;
		return acc;
	},
	{} as Record<SwarmCommandKey, SwarmCommandUsage>,
);

export const SWARM_COMMAND_HANDLER_MAP: Record<
	SwarmCommandKey,
	SwarmCommandHandlerRef
> = SWARM_COMMAND_ORDER.reduce(
	(acc, key) => {
		acc[key] = SWARM_COMMAND_REGISTRY[key].handler;
		return acc;
	},
	{} as Record<SwarmCommandKey, SwarmCommandHandlerRef>,
);

// Messaging-only rewrite hints for legacy phrases.
// This map is intentionally non-dispatch and should never be used to execute commands.
export const normalizeLegacySwarmPhraseForLookup = (phrase: string): string =>
	phrase
		.trim()
		.toLowerCase()
		.replace(/^\/+/, '')
		.replace(/[-_]+/g, ' ')
		.replace(/\s+/g, ' ');

// Keys in this map must be normalized via normalizeLegacySwarmPhraseForLookup.
export const LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY: Readonly<
	Record<string, SwarmCommandKey>
> = {
	status: 'swarm-status',
	'swarm status': 'swarm-status',
	plan: 'swarm-plan',
	'swarm plan': 'swarm-plan',
	agents: 'swarm-agents',
	'swarm agents': 'swarm-agents',
	history: 'swarm-history',
	'swarm history': 'swarm-history',
	config: 'swarm-config',
	'swarm config': 'swarm-config',
	'config doctor': 'swarm-config-doctor',
	'swarm config doctor': 'swarm-config-doctor',
	doctor: 'swarm-doctor',
	'swarm doctor': 'swarm-doctor',
	evidence: 'swarm-evidence',
	'swarm evidence': 'swarm-evidence',
	'evidence summary': 'swarm-evidence-summary',
	'swarm evidence summary': 'swarm-evidence-summary',
	archive: 'swarm-archive',
	'swarm archive': 'swarm-archive',
	diagnose: 'swarm-diagnose',
	'swarm diagnose': 'swarm-diagnose',
	preflight: 'swarm-preflight',
	'swarm preflight': 'swarm-preflight',
	'sync plan': 'swarm-sync-plan',
	'swarm sync plan': 'swarm-sync-plan',
	benchmark: 'swarm-benchmark',
	'swarm benchmark': 'swarm-benchmark',
	export: 'swarm-export',
	'swarm export': 'swarm-export',
	reset: 'swarm-reset',
	'swarm reset': 'swarm-reset',
	retrieve: 'swarm-retrieve',
	'swarm retrieve': 'swarm-retrieve',
};
