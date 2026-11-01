#!/usr/bin/env node
// Start a hand-built node package from the skill's templates/.
//
//   node scaffold.mjs --dir <target> --name <NodeName> --service <slug>
//        [--owner <github user>] [--author "<Name>"] [--email <email>]
//        [--description "<one sentence>"] [--usable-as-tool] [--paginated] [--resource-locator]
//        [--no-install]
//
// --name       PascalCase node/class name, e.g. MusicBrainz
// --service    package suffix, e.g. musicbrainz -> n8n-nodes-musicbrainz
// --usable-as-tool  include actions/output.ts (+ test): the AI-tool Output parameter
// --paginated       include actions/pagination.ts (+ test): Return All + Limit
// --resource-locator include actions/resourceLocator.ts (+ test): From List /
//                   By ID / By URL picker, its URL preSend and listSearch factory
//
// Copies the templates, fills package.json placeholders, creates empty
// nodes/<Name>/ and credentials/, runs npm install, then lists what's left to
// write. The target must be empty or not exist. Writes no node, credential,
// codex or icon file: those are service-specific.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_DIR, parseArgs, walk } from './lib.mjs';

const { flags } = parseArgs();
for (const required of ['dir', 'name', 'service']) {
	if (!flags[required] || flags[required] === true) {
		console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 19).join('\n'));
		process.exit(1);
	}
}
if (!/^[A-Z][A-Za-z0-9]*$/.test(flags.name)) {
	console.error('--name must be PascalCase, e.g. MusicBrainz');
	process.exit(1);
}

const target = path.resolve(flags.dir);
if (fs.existsSync(target) && fs.readdirSync(target).length) {
	console.error(`${target} is not empty - refusing to overwrite.`);
	process.exit(1);
}

const templates = path.join(SKILL_DIR, 'templates');
const optional = {
	'actions/output.ts': flags['usable-as-tool'],
	'__tests__/output.test.ts': flags['usable-as-tool'],
	'actions/pagination.ts': flags.paginated,
	'__tests__/pagination.test.ts': flags.paginated,
	'actions/resourceLocator.ts': flags['resource-locator'],
	'__tests__/resourceLocator.test.ts': flags['resource-locator'],
};

const copied = [];
for (const file of walk(templates)) {
	let rel = path.relative(templates, file).replace(/\\/g, '/');
	if (rel === 'README.md') continue;
	if (rel === 'PACKAGE_README.md') rel = 'README.md';
	const opt = Object.keys(optional).find((suffix) => rel.endsWith(suffix));
	if (opt && !optional[opt]) continue;
	rel = rel.replace('__NodeName__', flags.name);
	const dest = path.join(target, rel);
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.copyFileSync(file, dest);
	copied.push(rel);
}
fs.mkdirSync(path.join(target, 'credentials'), { recursive: true });
fs.mkdirSync(path.join(target, 'nodes', flags.name), { recursive: true });

// package.json and README placeholders
const pkgPath = path.join(target, 'package.json');
const replacements = {
	__service__: flags.service,
	__NodeName__: flags.name,
	__Year__: String(new Date().getFullYear()),
	...(typeof flags.owner === 'string' && { __owner__: flags.owner }),
	...(typeof flags.author === 'string' && { '__Author Name__': flags.author }),
	...(typeof flags.email === 'string' && { '__author@example.com__': flags.email }),
	...(typeof flags.description === 'string' && {
		'__One sentence: what this community node does__': flags.description,
	}),
};
const readmePath = path.join(target, 'README.md');
// __NodeName__ also names the e2e workflow ID, so packages don't overwrite
// each other's test workflow in the same n8n.
const e2ePath = path.join(target, 'test', 'e2e', 'retry.e2e.cjs');
const licensePath = path.join(target, 'LICENSE');
for (const file of [pkgPath, readmePath, e2ePath, licensePath]) {
	if (!fs.existsSync(file)) continue;
	let text = fs.readFileSync(file, 'utf8');
	for (const [from, to] of Object.entries(replacements)) text = text.split(from).join(to);
	fs.writeFileSync(file, text);
}

console.log(`Scaffolded ${target}`);
for (const rel of copied.sort()) console.log(`  + ${rel}`);

if (!flags['no-install']) {
	console.log('\nnpm install ...');
	const install = spawnSync('npm install', { cwd: target, shell: true, encoding: 'utf8', stdio: 'inherit' });
	if (install.status !== 0) console.error('npm install failed - run it manually.');
}

const left = [];
for (const file of [pkgPath, readmePath, path.join(target, 'test', 'e2e', 'retry.e2e.cjs')]) {
	if (!fs.existsSync(file)) continue;
	const hits = fs.readFileSync(file, 'utf8').match(/__(?!tests__)[A-Za-z][A-Za-z0-9 .@:-]*__/g);
	const relevant = (hits ?? []).filter((h) => h !== '__filename' && h !== '__dirname');
	if (relevant.length) left.push(`${path.relative(target, file)}: ${[...new Set(relevant)].join(', ')}`);
}
const name = flags.name;
console.log(`
Still to write (service-specific, see SKILL.md Steps 3-6):
  nodes/${name}/${name}.node.ts        (references/07-tutorial-declarative.md)
  nodes/${name}/${name}.node.json      (references/09-reference-codex-files.md)
  nodes/${name}/${name.toLowerCase()}.svg + .dark.svg   (scripts/fetch-icon.mjs --slug <service> --dir nodes/${name} --name ${name.toLowerCase()})
  credentials/${name}Api.credentials.ts (references/10-reference-credentials-files.md; needs an icon, file:../nodes/${name}/...)
  README.md sections                    (Credentials, Operations, Rate limit; SKILL.md Step 6)
  scripts/seed-credential.cjs CONFIG    (test credential from .env; references/10-reference-credentials-files.md)
${left.length ? `\nPlaceholders left to fill:\n  ${left.join('\n  ')}` : ''}
Then: node ${path.join(SKILL_DIR, 'scripts', 'check-package.mjs').replace(/\\/g, '/')} ${target.replace(/\\/g, '/')}`);
