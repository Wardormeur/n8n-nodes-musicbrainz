#!/usr/bin/env node
// Read the globally installed n8n's internals without hand-building paths.
//
//   node n8n-source.mjs version
//   node n8n-source.mjs grep <pkg> <regex> [--files <substring>] [--max 60]
//   node n8n-source.mjs show <pkg> <file> <startLine> [endLine]
//
// <pkg>: core (n8n-core), workflow (n8n-workflow), nodes-base, cli (n8n itself).
// <file> is relative to the package's dist folder, e.g.
//   show core execution-engine/routing-node.js 325 400
import fs from 'node:fs';
import path from 'node:path';
import { globalN8nRoot, parseArgs, walk } from './lib.mjs';

const root = globalN8nRoot();
if (!root) {
	console.error('No global n8n found (npm root -g). Install it with: npm install -g n8n');
	process.exit(1);
}

const PACKAGES = {
	core: path.join(root, 'node_modules', 'n8n-core', 'dist'),
	workflow: path.join(root, 'node_modules', 'n8n-workflow', 'dist', 'cjs'),
	'nodes-base': path.join(root, 'node_modules', 'n8n-nodes-base', 'dist'),
	cli: path.join(root, 'dist'),
};

function pkgDir(name) {
	const dir = PACKAGES[name];
	if (!dir || !fs.existsSync(dir)) {
		console.error(`Unknown or missing package "${name}". Use one of: ${Object.keys(PACKAGES).join(', ')}`);
		process.exit(1);
	}
	return dir;
}

const { flags, positional } = parseArgs();
const [command, ...rest] = positional;

if (command === 'version') {
	const version = (p) => JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8')).version;
	console.log(`n8n             ${version(root)}  (${root})`);
	for (const p of ['n8n-core', 'n8n-workflow', 'n8n-nodes-base']) {
		const dir = path.join(root, 'node_modules', p);
		if (fs.existsSync(dir)) console.log(`${p.padEnd(16)}${version(dir)}`);
	}
} else if (command === 'grep') {
	const [pkg, pattern] = rest;
	if (!pkg || !pattern) {
		console.error('usage: grep <pkg> <regex> [--files <substring>] [--max 60]');
		process.exit(1);
	}
	const dir = pkgDir(pkg);
	const regex = new RegExp(pattern);
	const max = Number(flags.max ?? 60);
	let shown = 0;
	for (const file of walk(dir)) {
		if (!file.endsWith('.js') && !file.endsWith('.d.ts')) continue;
		const rel = path.relative(dir, file).replace(/\\/g, '/');
		if (flags.files && !rel.includes(flags.files)) continue;
		const lines = fs.readFileSync(file, 'utf8').split('\n');
		for (let i = 0; i < lines.length; i++) {
			if (regex.test(lines[i])) {
				console.log(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
				if (++shown >= max) {
					console.log(`... stopped at ${max} matches (use --max or --files to narrow)`);
					process.exit(0);
				}
			}
		}
	}
	if (shown === 0) console.log('no matches');
} else if (command === 'show') {
	const [pkg, file, start, end] = rest;
	if (!pkg || !file || !start) {
		console.error('usage: show <pkg> <file> <startLine> [endLine]');
		process.exit(1);
	}
	const full = path.join(pkgDir(pkg), file);
	const lines = fs.readFileSync(full, 'utf8').split('\n');
	const from = Number(start);
	const to = Math.min(Number(end ?? from + 40), lines.length);
	for (let i = from; i <= to; i++) console.log(`${String(i).padStart(5)}  ${lines[i - 1]}`);
} else {
	console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 11).join('\n'));
	process.exit(command ? 1 : 0);
}
