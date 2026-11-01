#!/usr/bin/env node
// Consistency check for this skill itself. Run after editing it.
//
//   node check-skill.mjs [--package <node package>]
//
// Checks: markdown links and #anchors between SKILL.md / references /
// templates README resolve; backticked templates/, scripts/ and references/
// paths exist; sources.json parses and its files exist; every template file
// is listed in templates/README.md; every script passes `node --check`.
// With --package: the lint plugin installed there has no recommended rule
// missing from sources.json's rule_snapshot (new rules are printed with
// their descriptions and messages, to judge against reference 19).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SKILL_DIR, parseArgs, slug, walk } from './lib.mjs';

const { flags } = parseArgs();

const problems = [];
const rel = (p) => path.relative(SKILL_DIR, p).replace(/\\/g, '/');
const docs = [
	path.join(SKILL_DIR, 'SKILL.md'),
	path.join(SKILL_DIR, 'templates', 'README.md'),
	...walk(path.join(SKILL_DIR, 'references')).filter((f) => f.endsWith('.md')),
];

const headingSlugs = new Map();
const slugsOf = (file) => {
	if (!headingSlugs.has(file)) {
		const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
		headingSlugs.set(file, new Set([...text.matchAll(/^#+ (.+)$/gm)].map((m) => slug(m[1]))));
	}
	return headingSlugs.get(file);
};

for (const doc of docs) {
	const text = fs.readFileSync(doc, 'utf8');
	// [text](target.md#anchor) and [text](#anchor)
	for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
		if (/^https?:/.test(target)) continue;
		// only file-like targets or #anchors; skips literal examples like "[text](url)"
		if (!/[./#]/.test(target)) continue;
		const [file, anchor] = target.split('#');
		const resolved = file ? path.resolve(path.dirname(doc), file) : doc;
		if (!fs.existsSync(resolved)) {
			problems.push(`${rel(doc)}: link target missing: ${target}`);
		} else if (anchor && resolved.endsWith('.md') && !slugsOf(resolved).has(anchor)) {
			problems.push(`${rel(doc)}: anchor not found: ${target}`);
		}
	}
	// `templates/...`, `scripts/...`, `references/...` paths in backticks
	for (const [, p] of text.matchAll(/`((?:templates|scripts|references)\/[A-Za-z0-9_./-]+?)`/g)) {
		const clean = p.replace(/[.,:;]+$/, '');
		if (/\bNN-/.test(clean)) continue; // naming pattern, e.g. references/NN-slug.md
		// `scripts/x` may mean the package's scripts folder, shipped as templates/scripts/x
		const candidates = [path.join(SKILL_DIR, clean), path.join(SKILL_DIR, 'templates', clean)];
		if (!candidates.some((c) => fs.existsSync(c))) problems.push(`${rel(doc)}: path missing: ${clean}`);
	}
}

// Pasted copies of a file inside itself. String.replace expands $` (text
// before the match), $& and $' in a replacement string, so an edit whose new
// text contains e.g. `^…$` pastes the file's beginning mid-line. Links and
// paths stay valid, so nothing else here notices.
for (const file of new Set([...docs, ...walk(path.join(SKILL_DIR, 'templates')), ...walk(path.join(SKILL_DIR, 'scripts'))])) {
	if (!/\.(md|mjs|cjs|js|ts|json)$/.test(file)) continue;
	const text = fs.readFileSync(file, 'utf8');
	const head = text.slice(0, 120);
	if (head.length === 120 && text.indexOf(head, 1) >= 0) {
		problems.push(`${rel(file)}: its first 120 characters appear again inside it (a pasted copy?)`);
		continue;
	}
	const counts = new Map();
	for (const line of text.split('\n')) {
		if (line.trim().length >= 70) counts.set(line, (counts.get(line) ?? 0) + 1);
	}
	const repeated = [...counts].filter(([, n]) => n > 1);
	if (repeated.length > 2) {
		problems.push(`${rel(file)}: ${repeated.length} long lines appear more than once (a pasted copy?)`);
	}
}

// sources.json
let sources;
try {
	sources = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'references', 'sources.json'), 'utf8'));
	for (const page of sources.pages ?? []) {
		if (!fs.existsSync(path.join(SKILL_DIR, 'references', page.file))) {
			problems.push(`sources.json: pages[].file missing: ${page.file}`);
		}
	}
	for (const file of sources.templates?.files ?? []) {
		if (!fs.existsSync(path.join(SKILL_DIR, 'templates', file))) {
			problems.push(`sources.json: templates.files missing: ${file}`);
		}
	}
} catch (error) {
	problems.push(`sources.json: ${error.message}`);
}

// every template file is documented
const readme = fs.readFileSync(path.join(SKILL_DIR, 'templates', 'README.md'), 'utf8');
for (const file of walk(path.join(SKILL_DIR, 'templates'))) {
	const r = path.relative(path.join(SKILL_DIR, 'templates'), file).replace(/\\/g, '/');
	if (r !== 'README.md' && !readme.includes(`\`${r}\``)) problems.push(`templates/README.md doesn't list ${r}`);
}

// scripts parse
for (const file of walk(path.join(SKILL_DIR, 'scripts')).filter((f) => /\.(mjs|cjs|js)$/.test(f))) {
	const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
	if (check.status !== 0) problems.push(`${rel(file)}: ${check.stderr.split('\n')[0]}`);
}

// lint plugin drift
if (flags.package) {
	const PLUGIN = '@n8n/eslint-plugin-community-nodes';
	const pkgDir = path.resolve(String(flags.package));
	const snapshot = sources?.non_docs_repos_checked?.find((e) => e.repo.includes(PLUGIN.split('/')[1]))?.rule_snapshot;
	let entry;
	try {
		entry = createRequire(path.join(pkgDir, 'package.json')).resolve(PLUGIN);
	} catch {
		problems.push(`${PLUGIN} isn't installed in ${pkgDir} (run npm install there)`);
	}
	if (entry && !snapshot) problems.push('sources.json: no rule_snapshot for the lint plugin');
	if (entry && snapshot) {
		const root = entry.slice(0, entry.lastIndexOf('dist'));
		const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
		const { n8nCommunityNodesPlugin: plugin } = await import(pathToFileURL(entry).href);
		const installed = Object.keys(plugin.configs.recommended.rules).map((k) => k.split('/').pop());
		const added = installed.filter((name) => !snapshot.rules.includes(name));
		const removed = snapshot.rules.filter((name) => !installed.includes(name));
		console.log(`${PLUGIN} ${version} (snapshot ${snapshot.version}): ${installed.length} rules, ${added.length} new, ${removed.length} removed`);
		for (const name of added) {
			const level = plugin.configs.recommended.rules[`@n8n/community-nodes/${name}`] ?? '?';
			const meta = plugin.rules[name]?.meta ?? {};
			console.log(`  + ${name} (${Array.isArray(level) ? level[0] : level}): ${meta.docs?.description ?? ''}`);
			for (const message of Object.values(meta.messages ?? {})) console.log(`      - ${message}`);
		}
		for (const name of removed) console.log(`  - ${name}`);
		if (added.length || removed.length) {
			problems.push(
				`lint plugin ${version} differs from the snapshot: judge the new rules against reference 19 (copy rules? build-relevant?), then update rule_snapshot in sources.json`,
			);
		}
	}
}

if (problems.length) {
	console.log(`${problems.length} problem(s):`);
	for (const p of problems) console.log(`  - ${p}`);
	process.exit(1);
}
console.log(`OK: ${docs.length} docs, links, anchors, paths, sources.json, templates README and scripts all consistent.`);
