import { describe, expect, test } from 'bun:test';
import {
	LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY,
	normalizeLegacySwarmPhraseForLookup,
} from '../../../src/commands/registry';

const resolveLegacy = (input: string): string | undefined =>
	LEGACY_SWARM_PHRASE_TO_CANONICAL_MESSAGE_ONLY[
		normalizeLegacySwarmPhraseForLookup(input)
	];

describe('registry normalization adversarial security', () => {
	test('rejects malformed runtime inputs by throwing', () => {
		expect(() =>
			normalizeLegacySwarmPhraseForLookup(null as unknown as string),
		).toThrow();
		expect(() =>
			normalizeLegacySwarmPhraseForLookup(undefined as unknown as string),
		).toThrow();
		expect(() =>
			normalizeLegacySwarmPhraseForLookup(42 as unknown as string),
		).toThrow();
		expect(() =>
			normalizeLegacySwarmPhraseForLookup({ cmd: 'status' } as unknown as string),
		).toThrow();
	});

	test('does not map separator-abuse payloads to canonical commands', () => {
		expect(resolveLegacy('/swarm///status')).toBeUndefined();
		expect(resolveLegacy('swarm..status')).toBeUndefined();
		expect(resolveLegacy('swarm-status-now')).toBeUndefined();
		expect(resolveLegacy('/swarm__status__extra')).toBeUndefined();
		expect(resolveLegacy('___---___')).toBeUndefined();
	});

	test('does not map unicode confusable or invisible-character payloads', () => {
		expect(resolveLegacy('ѕwarm status')).toBeUndefined();
		expect(resolveLegacy('swarm stаtus')).toBeUndefined();
		expect(resolveLegacy('swarm\u200B status')).toBeUndefined();
		expect(resolveLegacy('／swarm status')).toBeUndefined();
		expect(resolveLegacy('swarm status\u0000')).toBeUndefined();
	});

	test('handles oversized payloads without accidental canonical resolution', () => {
		const oversizedNoise = 'x'.repeat(200_000);
		const oversizedSeparatorFlood = `/${'_'.repeat(150_000)}status`;

		expect(() => normalizeLegacySwarmPhraseForLookup(oversizedNoise)).not.toThrow();
		expect(() => normalizeLegacySwarmPhraseForLookup(oversizedSeparatorFlood)).not.toThrow();
		expect(resolveLegacy(oversizedNoise)).toBeUndefined();
		expect(resolveLegacy(oversizedSeparatorFlood)).toBeUndefined();
	});

	test('enforces boundary behavior for empty or degenerate inputs', () => {
		expect(normalizeLegacySwarmPhraseForLookup('')).toBe('');
		expect(normalizeLegacySwarmPhraseForLookup('   \t\n\r   ')).toBe('');
		expect(normalizeLegacySwarmPhraseForLookup('/')).toBe('');
		expect(normalizeLegacySwarmPhraseForLookup('/////')).toBe('');
		expect(resolveLegacy('')).toBeUndefined();
		expect(resolveLegacy('   \t\n\r   ')).toBeUndefined();
		expect(resolveLegacy('/')).toBeUndefined();
		expect(resolveLegacy('/////')).toBeUndefined();
	});
});
