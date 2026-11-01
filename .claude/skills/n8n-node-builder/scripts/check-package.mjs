#!/usr/bin/env node
// Step 7 checklist for a node package, in one command.
//
//   node check-package.mjs [<package dir>] [--skip-build] [--skip-tests]
//
// Checks: package.json shape, leftover __placeholders__, build, CommonJS
// output, assets copied to dist, lint (treating "File ignored because no
// matching configuration" as a failure), unit tests, leftover console./debug
// markers. Prints each node's workflow `type` strings. Exit 1 on any FAIL.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs, walk } from './lib.mjs';

const { flags, positional } = parseArgs();
const dir = path.resolve(positional[0] ?? process.cwd());
const results = [];
const report = (status, check, detail = '') => results.push({ status, check, detail });
const npm = (script) =>
	spawnSync(`npm run ${script}`, { cwd: dir, shell: true, encoding: 'utf8', maxBuffer: 1 << 28 });
const rel = (p) => path.relative(dir, p).replace(/\\/g, '/');

const pkgPath = path.join(dir, 'package.json');
if (!fs.existsSync(pkgPath)) {
	console.error(`No package.json in ${dir}`);
	process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// --- package.json ----------------------------------------------------------
const problems = [];
if (!/^(@[^/]+\/)?n8n-nodes-/.test(pkg.name ?? '')) problems.push('name must start with n8n-nodes- (or @scope/n8n-nodes-)');
if (!pkg.keywords?.includes('n8n-community-node-package')) problems.push('keywords must include n8n-community-node-package');
if (pkg.type === 'module') problems.push('"type": "module" makes tsc emit ESM; n8n require()s nodes');
if (!pkg.files?.includes('dist')) problems.push('"files" should include "dist"');
if (!pkg.n8n?.nodes?.length) problems.push('n8n.nodes is empty');
for (const s of ['build', 'lint']) if (!pkg.scripts?.[s]) problems.push(`missing "${s}" script`);
if (!fs.existsSync(path.join(dir, 'README.md'))) problems.push('no README.md (templates/PACKAGE_README.md)');
if (pkg.scripts?.lint && !pkg.scripts.lint.includes('package.json')) problems.push('lint script should include package.json');
report(problems.length ? 'FAIL' : 'PASS', 'package.json shape', problems.join('; '));

// --- licence and publish workflow (n8n verification) -----------------------
const publishing = [];
if (pkg.license !== 'MIT') publishing.push('"license" must be "MIT"');
if (!fs.existsSync(path.join(dir, 'LICENSE'))) publishing.push('no LICENSE file (templates/LICENSE)');
const publishWorkflow = path.join(dir, '.github', 'workflows', 'publish.yml');
if (!fs.existsSync(publishWorkflow)) {
	publishing.push('no .github/workflows/publish.yml (templates/.github/workflows/publish.yml): n8n verifies only packages published from GitHub Actions with provenance');
} else if (!fs.readFileSync(publishWorkflow, 'utf8').includes('--provenance')) {
	publishing.push('publish.yml must run npm publish --provenance');
}
report(publishing.length ? 'FAIL' : 'PASS', 'licence and publish workflow', publishing.join('; '));

// --- placeholders ----------------------------------------------------------
const placeholder = /__(?!tests__)[A-Za-z][A-Za-z0-9 .@:-]*__/g;
const found = [];
const scanFiles = [
	pkgPath,
	path.join(dir, 'README.md'),
	path.join(dir, 'LICENSE'),
	...walk(path.join(dir, 'nodes'), new Set(['node_modules', '__tests__'])),
	...walk(path.join(dir, 'credentials')),
].filter((f) => fs.existsSync(f) && (/\.(ts|json|md|svg)$/.test(f) || path.basename(f) === 'LICENSE'));
for (const file of scanFiles) {
	const text = fs.readFileSync(file, 'utf8');
	const hits = text.match(placeholder) ?? [];
	if (text.includes('Delete this comment')) hits.push('template guidance comment');
	if (hits.length) found.push(`${rel(file)}: ${[...new Set(hits)].join(', ')}`);
}
const e2e = path.join(dir, 'test', 'e2e', 'retry.e2e.cjs');
if (fs.existsSync(e2e)) {
	const text = fs.readFileSync(e2e, 'utf8');
	const config = text.slice(text.indexOf('const CONFIG = {'), text.indexOf('};', text.indexOf('const CONFIG = {')));
	const hits = config.match(placeholder);
	if (hits) found.push(`test/e2e/retry.e2e.cjs CONFIG: ${[...new Set(hits)].join(', ')}`);
}
const seed = path.join(dir, 'scripts', 'seed-credential.cjs');
if (fs.existsSync(seed)) {
	const text = fs.readFileSync(seed, 'utf8');
	const config = text.slice(text.indexOf('const CONFIG = {'), text.indexOf('};', text.indexOf('const CONFIG = {')));
	const hits = config.match(/__[A-Za-z][A-Za-z0-9 _]*__/g);
	if (hits) found.push(`scripts/seed-credential.cjs CONFIG: ${[...new Set(hits)].join(', ')}`);
}
report(found.length ? 'FAIL' : 'PASS', 'no __placeholders__ left', found.join(' | '));

// --- build + output --------------------------------------------------------
if (!flags['skip-build']) {
	const build = npm('build');
	const errors = `${build.stdout}${build.stderr}`.split('\n').filter((l) => /error TS\d+|Error:/.test(l));
	report(build.status === 0 ? 'PASS' : 'FAIL', 'npm run build', errors.slice(0, 3).join(' | '));
}
const built = [...(pkg.n8n?.nodes ?? []), ...(pkg.n8n?.credentials ?? [])];
const missing = built.filter((p) => !fs.existsSync(path.join(dir, p)));
const esm = built.filter((p) => {
	const f = path.join(dir, p);
	return fs.existsSync(f) && !/exports\.|module\.exports/.test(fs.readFileSync(f, 'utf8').slice(0, 600));
});
report(
	missing.length || esm.length ? 'FAIL' : 'PASS',
	'n8n entries built as CommonJS',
	[missing.length && `missing: ${missing.join(', ')}`, esm.length && `not CommonJS: ${esm.join(', ')}`].filter(Boolean).join('; '),
);
const assets = walk(path.join(dir, 'nodes'), new Set(['node_modules', '__tests__'])).filter((f) =>
	/\.(svg|png|json)$/.test(f),
);
const uncopied = assets.filter((f) => !fs.existsSync(path.join(dir, 'dist', rel(f))));
report(uncopied.length ? 'FAIL' : 'PASS', 'icons/codex copied to dist', uncopied.map(rel).join(', '));

// --- lint ------------------------------------------------------------------
const lint = npm('lint');
const lintOut = `${lint.stdout}${lint.stderr}`;
const ignored = /File ignored because no matching configuration/.test(lintOut);
const summary = lintOut.match(/✖ \d+ problems?.*/)?.[0] ?? '';
// eslint's stylish format: a file path line, then "  line:col  error  message  rule" lines.
const findings = [];
let lintFile = '';
for (const line of lintOut.split(/\r?\n/)) {
	if (/^\S/.test(line) && /\.(ts|js|mjs|cjs|json)$/.test(line.trim())) lintFile = rel(line.trim());
	const hit = line.match(/^\s+(\d+:\d+)\s+(error|warning)\s+(.*)$/);
	if (hit) findings.push(`${lintFile}:${hit[1]} ${hit[2]} ${hit[3].replace(/\s{2,}/g, '  ')}`);
}
report(
	lint.status === 0 && !ignored ? (summary ? 'WARN' : 'PASS') : 'FAIL',
	'npm run lint',
	[
		ignored ? 'a file was IGNORED (config does not match it, see references/14-node-linter.md)' : summary,
		...findings.slice(0, 15),
		...(findings.length > 15 ? [`... ${findings.length - 15} more: npm run lint`] : []),
	]
		.filter(Boolean)
		.join('\n      '),
);

// --- unit tests ------------------------------------------------------------
if (!flags['skip-tests'] && fs.existsSync(path.join(dir, 'jest.config.js'))) {
	const test = spawnSync('npx jest --ci', { cwd: dir, shell: true, encoding: 'utf8', maxBuffer: 1 << 28 });
	const out = `${test.stdout}${test.stderr}`;
	const line = out.match(/Tests:.*/)?.[0] ?? 'no Tests: line';
	const ts151002 = out.includes('TS151002') ? ' (TS151002 warnings: set isolatedModules)' : '';
	report(test.status === 0 ? (ts151002 ? 'WARN' : 'PASS') : 'FAIL', 'unit tests', line + ts151002);
}

// --- leftovers -------------------------------------------------------------
const source = [
	...walk(path.join(dir, 'nodes'), new Set(['node_modules', '__tests__'])),
	...walk(path.join(dir, 'credentials')),
].filter((f) => f.endsWith('.ts'));
const consoleHits = [];
const debugHits = [];
const todoHits = [];
for (const file of source) {
	fs.readFileSync(file, 'utf8')
		.split('\n')
		.forEach((line, i) => {
			if (/\bconsole\./.test(line)) consoleHits.push(`${rel(file)}:${i + 1}`);
			if (/\b(DIAGNOSTIC|TEMP)\b/.test(line)) debugHits.push(`${rel(file)}:${i + 1}`);
			if (/\b(TODO|FIXME|XXX)\b/.test(line)) todoHits.push(`${rel(file)}:${i + 1}`);
		});
}
report(consoleHits.length ? 'FAIL' : 'PASS', 'no console. in node/credential code', consoleHits.join(', '));
report(debugHits.length ? 'FAIL' : 'PASS', 'no DIAGNOSTIC/TEMP leftovers', debugHits.join(', '));
report(todoHits.length ? 'WARN' : 'PASS', 'no TODO/FIXME markers', todoHits.join(', '));

// --- node type strings -----------------------------------------------------
const types = [];
try {
	const require = createRequire(pkgPath);
	for (const p of pkg.n8n?.nodes ?? []) {
		const mod = require(path.join(dir, p));
		// n8n loads the export named like the file up to its first dot
		// (Foo.node.js -> Foo; n8n-core directory-loader loadClass). Other
		// exports, such as constants, are allowed and ignored.
		const className = path.basename(p).split('.')[0];
		const NodeClass = mod[className];
		if (typeof NodeClass !== 'function') {
			types.push(`${p}: no exported class named ${className} (n8n looks the class up by the file name)`);
			continue;
		}
		const name = new NodeClass().description?.name;
		if (name) types.push(`CUSTOM.${name} (linked into ~/.n8n/custom)  |  ${pkg.name}.${name} (installed from npm)`);
	}
} catch (error) {
	types.push(`could not load built node: ${error.message}`);
}

for (const r of results) {
	console.log(`${r.status.padEnd(5)} ${r.check}${r.detail ? `\n      ${r.detail}` : ''}`);
}
if (types.length) console.log(`\nWorkflow node type:\n  ${types.join('\n  ')}`);
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
