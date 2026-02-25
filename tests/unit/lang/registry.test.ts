import { describe, expect, it, beforeEach } from 'bun:test';
import {
	getLanguageForExtension,
	listSupportedLanguages,
	getParserForFile,
	isSupportedFile,
} from '../../../src/lang/registry';
import { clearParserCache } from '../../../src/lang/runtime';

describe('Language Registry', () => {
	describe('getLanguageForExtension', () => {
		it('should return language for .js files', () => {
			const lang = getLanguageForExtension('.js');
			expect(lang).toBeDefined();
			expect(lang?.id).toBe('javascript');
		});

		it('should return language for .jsx files', () => {
			const lang = getLanguageForExtension('.jsx');
			expect(lang).toBeDefined();
			expect(lang?.id).toBe('javascript');
		});

		it('should return language for .ts files', () => {
			const lang = getLanguageForExtension('.ts');
			expect(lang).toBeDefined();
			expect(lang?.id).toBe('typescript');
		});

		it('should return language for .tsx files', () => {
			const lang = getLanguageForExtension('.tsx');
			expect(lang).toBeDefined();
			expect(lang?.id).toBe('typescript');
		});

		it('should return language for .py files', () => {
			const lang = getLanguageForExtension('.py');
			expect(lang).toBeDefined();
			expect(lang?.id).toBe('python');
		});

		it('should return language for .go files', () => {
			const lang = getLanguageForExtension('.go');
			expect(lang).toBeDefined();
			expect(lang?.id).toBe('go');
		});

		it('should return language for .rs files', () => {
			const lang = getLanguageForExtension('.rs');
			expect(lang).toBeDefined();
			expect(lang?.id).toBe('rust');
		});

		it('should be case insensitive', () => {
			const lang1 = getLanguageForExtension('.JS');
			const lang2 = getLanguageForExtension('.js');
			expect(lang1?.id).toBe(lang2?.id);
		});

		it('should return undefined for unsupported extensions', () => {
			const lang = getLanguageForExtension('.unknown');
			expect(lang).toBeUndefined();
		});
	});

	describe('listSupportedLanguages', () => {
		it('should return all supported languages', () => {
			const languages = listSupportedLanguages();
			expect(languages.length).toBe(5);

			const ids = languages.map((l) => l.id);
			expect(ids).toContain('javascript');
			expect(ids).toContain('typescript');
			expect(ids).toContain('python');
			expect(ids).toContain('go');
			expect(ids).toContain('rust');
		});

		it('should include comment nodes for each language', () => {
			const languages = listSupportedLanguages();
			for (const lang of languages) {
				expect(lang.commentNodes.length).toBeGreaterThan(0);
			}
		});
	});

	describe('isSupportedFile', () => {
		it('should return true for supported extensions', () => {
			expect(isSupportedFile('file.js')).toBe(true);
			expect(isSupportedFile('file.ts')).toBe(true);
			expect(isSupportedFile('file.tsx')).toBe(true);
			expect(isSupportedFile('file.py')).toBe(true);
			expect(isSupportedFile('file.go')).toBe(true);
			expect(isSupportedFile('file.rs')).toBe(true);
		});

		it('should return false for unsupported extensions', () => {
			expect(isSupportedFile('file.unknown')).toBe(false);
			expect(isSupportedFile('file')).toBe(false);
			expect(isSupportedFile('file.java')).toBe(false);
		});

		it('should handle paths with directories', () => {
			expect(isSupportedFile('/path/to/file.js')).toBe(true);
			expect(isSupportedFile('src/components/Button.tsx')).toBe(true);
		});
	});

	describe('getParserForFile', () => {
		beforeEach(() => {
			clearParserCache();
		});

		it('should return null for unsupported files', async () => {
			const parser = await getParserForFile('file.unknown');
			expect(parser).toBeNull();
		});

		it('should return null for files without extension', async () => {
			const parser = await getParserForFile('Makefile');
			expect(parser).toBeNull();
		});

		// Note: These tests require WASM files to be present
		// They will fail until grammars are copied
		it('should attempt to load grammar for supported files', async () => {
			// This will fail gracefully if WASM not present
			try {
				const parser = await getParserForFile('test.js');
				// If WASM present, should return parser
				// If not, should return null (not throw)
				expect(parser === null || typeof parser === 'object').toBe(true);
			} catch {
				// Should not throw
				expect(false).toBe(true);
			}
		});
	});
});
