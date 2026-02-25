import type { Language, Parser as ParserType } from 'web-tree-sitter';

// Re-export Parser type for consumers
export type Parser = ParserType;

/**
 * Parser cache to avoid reloading grammars multiple times per session
 */
export const parserCache = new Map<string, ParserType>();

/**
 * Track which languages have been initialized to avoid re-init
 */
const initializedLanguages = new Set<string>();

/**
 * Initialize a parser for the given language
 * Loads WASM from dist/lang/grammars/ (copied during build)
 *
 * @param languageId - Language identifier (e.g., 'javascript', 'python')
 * @returns Configured Parser instance
 * @throws Error if WASM file not found or failed to load
 */
export async function loadGrammar(languageId: string): Promise<ParserType> {
	// Return cached parser if available
	if (parserCache.has(languageId)) {
		return parserCache.get(languageId)!;
	}

	// Dynamic import web-tree-sitter (ESM compatibility)
	const { Parser } = await import('web-tree-sitter');

	// Initialize parser
	const parser = new Parser();

	// Load language WASM
	const wasmPath = new URL(
		`../../dist/lang/grammars/${languageId}.wasm`,
		import.meta.url,
	).pathname;

	try {
		const language = await Parser.Language.load(wasmPath);
		parser.setLanguage(language);
	} catch (error) {
		throw new Error(
			`Failed to load grammar for ${languageId}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	// Cache and return
	parserCache.set(languageId, parser);
	initializedLanguages.add(languageId);

	return parser;
}

/**
 * Check if a language grammar is available (WASM file exists)
 * Does not load the grammar, just checks existence
 *
 * @param languageId - Language identifier
 * @returns true if grammar is available
 */
export async function isGrammarAvailable(languageId: string): Promise<boolean> {
	// If already cached, it's available
	if (parserCache.has(languageId)) {
		return true;
	}

	// Try to check if WASM file exists
	try {
		const wasmPath = new URL(
			`../../dist/lang/grammars/${languageId}.wasm`,
			import.meta.url,
		).pathname;

		const { statSync } = await import('node:fs');
		statSync(wasmPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Clear the parser cache (useful for testing)
 */
export function clearParserCache(): void {
	parserCache.clear();
	initializedLanguages.clear();
}

/**
 * Get list of initialized languages
 */
export function getInitializedLanguages(): string[] {
	return Array.from(initializedLanguages);
}
