// Shared helpers for the n8n-node-builder scripts. Node built-ins only.
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Parse `--flag value`, `--flag` (true) and positional args. */
export function parseArgs(argv = process.argv.slice(2)) {
	const flags = {};
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith('--')) {
			const key = arg.slice(2);
			const next = argv[i + 1];
			if (next === undefined || next.startsWith('--')) flags[key] = true;
			else {
				flags[key] = next;
				i++;
			}
		} else positional.push(arg);
	}
	return { flags, positional };
}

/** Root of the globally installed n8n package, or null. */
export function globalN8nRoot() {
	try {
		const root = path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'n8n');
		return fs.existsSync(root) ? root : null;
	} catch {
		return null;
	}
}

/** Run the n8n CLI. One command string: `n8n` is a .cmd shim on Windows. */
export function n8n(args, env = {}) {
	return spawnSync(['n8n', ...args].join(' '), {
		shell: true,
		encoding: 'utf8',
		maxBuffer: 256 * 1024 * 1024,
		env: { ...process.env, ...env },
	});
}

/**
 * Extract the first complete top-level JSON object accepted by `accept` from
 * mixed CLI output. n8n prints log lines before the execution JSON (with
 * N8N_LOG_LEVEL=debug those lines carry their own `{...}` metadata) and
 * sometimes error text after it.
 */
export function extractJsonObject(text, accept = () => true) {
	for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
		let depth = 0;
		let inString = false;
		let escaped = false;
		for (let i = start; i < text.length; i++) {
			const ch = text[i];
			if (inString) {
				if (escaped) escaped = false;
				else if (ch === '\\') escaped = true;
				else if (ch === '"') inString = false;
			} else if (ch === '"') inString = true;
			else if (ch === '{') depth++;
			else if (ch === '}' && --depth === 0) {
				try {
					const value = JSON.parse(text.slice(start, i + 1));
					if (accept(value)) return value;
				} catch {
					// not JSON after all
				}
				break; // try the next '{'
			}
		}
	}
	return null;
}

/** Recursively list files under dir, skipping the given directory names. */
export function walk(dir, skip = new Set(['node_modules', '.git'])) {
	const out = [];
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!skip.has(entry.name)) out.push(...walk(full, skip));
		} else out.push(full);
	}
	return out;
}

/** GitHub-style heading slug, as used by the skill's cross-file anchors. */
export function slug(heading) {
	return heading
		.toLowerCase()
		.replace(/[^a-z0-9 -]/g, '')
		.replace(/ /g, '-');
}
