#!/usr/bin/env bun
/**
 * Copy grammar WASM files from @vscode/tree-sitter-wasm to src/lang/grammars/
 * Run automatically via postinstall hook
 */

import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const LANGUAGE_GRAMMARS = [
	'javascript',
	'typescript',
	'python',
	'go',
	'rust',
] as const;

const SOURCE_DIR = join(
	process.cwd(),
	'node_modules',
	'@vscode',
	'tree-sitter-wasm',
	'dist',
);
const TARGET_DIR = join(process.cwd(), 'src', 'lang', 'grammars');

function copyGrammars(): void {
	// Ensure target directory exists
	if (!existsSync(TARGET_DIR)) {
		mkdirSync(TARGET_DIR, { recursive: true });
		console.log(`Created directory: ${TARGET_DIR}`);
	}

	// Copy core tree-sitter.wasm
	const coreSource = join(SOURCE_DIR, 'tree-sitter.wasm');
	const coreTarget = join(TARGET_DIR, 'tree-sitter.wasm');

	if (!existsSync(coreSource)) {
		console.error('Error: tree-sitter.wasm not found in @vscode/tree-sitter-wasm');
		console.error('Expected at:', coreSource);
		process.exit(1);
	}

	copyFileSync(coreSource, coreTarget);
	console.log(`Copied: tree-sitter.wasm`);

	// Copy language grammars
	let copied = 0;
	let skipped = 0;

	for (const lang of LANGUAGE_GRAMMARS) {
		const sourceFile = join(SOURCE_DIR, `${lang}.wasm`);
		const targetFile = join(TARGET_DIR, `${lang}.wasm`);

		if (existsSync(sourceFile)) {
			copyFileSync(sourceFile, targetFile);
			console.log(`Copied: ${lang}.wasm`);
			copied++;
		} else {
			console.warn(`Warning: ${lang}.wasm not found, skipping`);
			skipped++;
		}
	}

	console.log(
		`\nGrammar copy complete: ${copied + 1} files copied, ${skipped} skipped`,
	);
}

// Run if executed directly
if (import.meta.main) {
	try {
		copyGrammars();
	} catch (error) {
		console.error('Failed to copy grammars:', error);
		process.exit(1);
	}
}

export { copyGrammars, LANGUAGE_GRAMMARS };
