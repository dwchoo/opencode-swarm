import { describe, expect, test } from 'bun:test';
import {
	LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY,
	normalizeLegacySwarmPhraseForLookup,
	SWARM_COMMAND_HANDLER_MAP,
	SWARM_COMMAND_LIST,
	SWARM_COMMAND_ORDER,
	SWARM_COMMAND_REGISTRY,
	SWARM_COMMAND_USAGE_MAP,
} from '../../../src/commands/registry';

describe('commands registry task 1.2 verification', () => {
	test('keeps canonical command order stable and explicit', () => {
		expect(SWARM_COMMAND_ORDER).toEqual([
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
		]);
		expect(SWARM_COMMAND_ORDER).not.toContain('swarm');
	});

	test('registry is complete for all canonical command keys', () => {
		const orderSet = new Set(SWARM_COMMAND_ORDER);
		const registryKeys = Object.keys(SWARM_COMMAND_REGISTRY);

		expect(registryKeys).toHaveLength(SWARM_COMMAND_ORDER.length);
		expect(new Set(registryKeys)).toEqual(orderSet);

		for (const key of SWARM_COMMAND_ORDER) {
			const entry = SWARM_COMMAND_REGISTRY[key];
			expect(entry).toBeDefined();
			expect(entry.usage).toBe(`/${key}`);
			expect(entry.handler).toBeTypeOf('function');
			expect(entry.legacyRewriteHint).toContain(`/${key}`);
		}
	});

	test('derived list and maps stay aligned with registry/order', () => {
		expect(SWARM_COMMAND_LIST).toHaveLength(SWARM_COMMAND_ORDER.length);

		for (const [index, key] of SWARM_COMMAND_ORDER.entries()) {
			const entry = SWARM_COMMAND_REGISTRY[key];
			expect(SWARM_COMMAND_LIST[index]).toBe(entry);
			expect(SWARM_COMMAND_USAGE_MAP[key]).toBe(entry.usage);
			expect(SWARM_COMMAND_HANDLER_MAP[key]).toBe(entry.handler);
		}
	});

	test('normalizes legacy phrases for lookup across case, slash, and separators', () => {
		expect(normalizeLegacySwarmPhraseForLookup('  /SWARM   STATUS ')).toBe(
			'swarm status',
		);
		expect(normalizeLegacySwarmPhraseForLookup('swarm_status')).toBe(
			'swarm status',
		);
		expect(normalizeLegacySwarmPhraseForLookup('swarm-status')).toBe(
			'swarm status',
		);
		expect(normalizeLegacySwarmPhraseForLookup('///SYNC---PLAN')).toBe(
			'sync plan',
		);
		expect(normalizeLegacySwarmPhraseForLookup('   ')).toBe('');
		expect(normalizeLegacySwarmPhraseForLookup('')).toBe('');
	});

	test('legacy phrase map resolves normalized aliases to canonical commands', () => {
		const aliases = [
			' /swarm status ',
			'STATUS',
			'swarm_status',
			'/swarm-config-doctor',
			'config doctor',
			'/Swarm   Evidence   Summary',
			'swarm sync plan',
			'/swarm_retrieve',
		] as const;

		expect(
			LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY[
				normalizeLegacySwarmPhraseForLookup(aliases[0])
			],
		).toBe('swarm-status');
		expect(
			LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY[
				normalizeLegacySwarmPhraseForLookup(aliases[1])
			],
		).toBe('swarm-status');
		expect(
			LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY[
				normalizeLegacySwarmPhraseForLookup(aliases[2])
			],
		).toBe('swarm-status');
		expect(
			LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY[
				normalizeLegacySwarmPhraseForLookup(aliases[3])
			],
		).toBe('swarm-config-doctor');
		expect(
			LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY[
				normalizeLegacySwarmPhraseForLookup(aliases[4])
			],
		).toBe('swarm-config-doctor');
		expect(
			LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY[
				normalizeLegacySwarmPhraseForLookup(aliases[5])
			],
		).toBe('swarm-evidence-summary');
		expect(
			LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY[
				normalizeLegacySwarmPhraseForLookup(aliases[6])
			],
		).toBe('swarm-sync-plan');
		expect(
			LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY[
				normalizeLegacySwarmPhraseForLookup(aliases[7])
			],
		).toBe('swarm-retrieve');
	});

	test('legacy mapping table is normalized and constrained to canonical keys', () => {
		const canonicalSet = new Set(SWARM_COMMAND_ORDER);
		for (const [legacyPhrase, canonical] of Object.entries(
			LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY,
		)) {
			expect(legacyPhrase).toBe(normalizeLegacySwarmPhraseForLookup(legacyPhrase));
			expect(canonicalSet.has(canonical)).toBe(true);
			expect(legacyPhrase.startsWith('/')).toBe(false);
		}
	});

	test('rejects non-string normalization inputs at runtime', () => {
		expect(() =>
			normalizeLegacySwarmPhraseForLookup(null as unknown as string),
		).toThrow();
		expect(() =>
			normalizeLegacySwarmPhraseForLookup(undefined as unknown as string),
		).toThrow();
		expect(() =>
			normalizeLegacySwarmPhraseForLookup({ value: 'status' } as unknown as string),
		).toThrow();
	});
});
