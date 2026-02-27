import { handleAgentsCommand } from './agents';
import { handleArchiveCommand } from './archive';
import { handleBenchmarkCommand } from './benchmark';
import { handleConfigCommand } from './config';
import { handleDiagnoseCommand } from './diagnose';
import { handleDoctorCommand } from './doctor';
import { handleEvidenceCommand, handleEvidenceSummaryCommand } from './evidence';
import { handleExportCommand } from './export';
import { handleHistoryCommand } from './history';
import { handlePlanCommand } from './plan';
import { handlePreflightCommand } from './preflight';
import { handleResetCommand } from './reset';
import { handleRetrieveCommand } from './retrieve';
import { handleStatusCommand } from './status';
import { handleSyncPlanCommand } from './sync-plan';
export declare const SWARM_COMMAND_ORDER: readonly ["swarm-status", "swarm-plan", "swarm-agents", "swarm-history", "swarm-config", "swarm-config-doctor", "swarm-doctor", "swarm-evidence", "swarm-evidence-summary", "swarm-archive", "swarm-diagnose", "swarm-preflight", "swarm-sync-plan", "swarm-benchmark", "swarm-export", "swarm-reset", "swarm-retrieve"];
export type SwarmCommandKey = (typeof SWARM_COMMAND_ORDER)[number];
export type SwarmCommandHandlerRef = typeof handleStatusCommand | typeof handlePlanCommand | typeof handleAgentsCommand | typeof handleHistoryCommand | typeof handleConfigCommand | typeof handleDoctorCommand | typeof handleEvidenceCommand | typeof handleEvidenceSummaryCommand | typeof handleArchiveCommand | typeof handleDiagnoseCommand | typeof handlePreflightCommand | typeof handleSyncPlanCommand | typeof handleBenchmarkCommand | typeof handleExportCommand | typeof handleResetCommand | typeof handleRetrieveCommand;
export type SwarmCommandUsage = `/${SwarmCommandKey}`;
export interface SwarmCommandRegistryEntry {
    handler: SwarmCommandHandlerRef;
    usage: SwarmCommandUsage;
    legacyRewriteHint: string;
    required?: {
        minPositionalArgs?: number;
        requiredFlags?: string[];
        missingArgsMessage?: string;
        usage: string;
        example: string;
    };
}
export declare const SWARM_COMMAND_REGISTRY: Record<SwarmCommandKey, SwarmCommandRegistryEntry>;
export declare const SWARM_COMMAND_LIST: ReadonlyArray<SwarmCommandRegistryEntry>;
export declare const SWARM_COMMAND_USAGE_MAP: Record<SwarmCommandKey, SwarmCommandUsage>;
export declare const SWARM_COMMAND_HANDLER_MAP: Record<SwarmCommandKey, SwarmCommandHandlerRef>;
export declare const normalizeLegacySwarmPhraseForLookup: (phrase: string) => string;
export declare const LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY: Readonly<Record<string, SwarmCommandKey>>;
