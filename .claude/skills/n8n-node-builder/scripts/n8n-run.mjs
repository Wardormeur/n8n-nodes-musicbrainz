#!/usr/bin/env node
// Import and execute a workflow JSON in the local n8n, then summarize it.
//
//   node n8n-run.mjs <workflow.json> [--count-http <host>[/pathPrefix]] [--headers <names>] [--debug] [--json]
//
// - The file may hold one workflow object or an array with one. It gets an
//   id if it has none (imports overwrite a workflow with the same id).
// - Credentials written as "auto" are resolved by type from the local n8n:
//     "credentials": { "musicBrainzApi": "auto" }
// - --count-http preloads templates/test/e2e/http-counter.cjs into n8n and
//   lists the matching HTTP calls with the time since the previous one.
// - --headers user-agent[,accept...] (with --count-http) also records those
//   request headers per call, e.g. to check a credential's User-Agent is
//   sent without exporting the credential decrypted. Not for secret headers.
// - --debug runs with N8N_LOG_LEVEL=debug and lists per-attempt node log
//   lines (each Retry On Fail attempt logs "Running node ... started").
// - --json prints the summary as JSON instead of text:
//     { workflowId, wallMs, status, error?,
//       nodes: [{ name, runs, executionTime, items, error?, firstItem, pairedItems }],
//       http:  [{ t, method, host, path, headers?, sincePreviousMs }],
//       debug: [log lines] }
// - When n8n prints only "No active execution found" (the workflow failed
//   its pre-run checks, e.g. a parameter failing validation), the stored
//   execution's error is read from ~/.n8n/database.sqlite (read-only).
// Exit code: 0 when the execution status is "success", 1 otherwise.
//
// Node types: a package linked into ~/.n8n/custom is CUSTOM.<nodeName>; one
// installed from npm is <package-name>.<nodeName>.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SKILL_DIR, extractJsonObject, globalN8nRoot, n8n, parseArgs } from './lib.mjs';

const { flags, positional } = parseArgs();
const [file] = positional;
if (!file) {
	console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 19).join('\n'));
	process.exit(1);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'n8n-run-'));
let workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
if (Array.isArray(workflow)) workflow = workflow[0];
workflow.id ??= 'n8nRun' + Date.now().toString(36);
workflow.name ??= path.basename(file);
workflow.active ??= false;
workflow.settings ??= {};

// Resolve "auto" credentials by type.
const wanted = new Set();
for (const node of workflow.nodes) {
	for (const [type, value] of Object.entries(node.credentials ?? {})) if (value === 'auto') wanted.add(type);
}
if (wanted.size) {
	const credFile = path.join(work, 'creds.json');
	n8n(['export:credentials', '--all', `--output="${credFile}"`]);
	const all = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, 'utf8')) : [];
	fs.rmSync(credFile, { force: true });
	for (const node of workflow.nodes) {
		for (const [type, value] of Object.entries(node.credentials ?? {})) {
			if (value !== 'auto') continue;
			const found = all.find((c) => c.type === type);
			if (!found) {
				console.error(`No credential of type "${type}" in the local n8n - create one first.`);
				process.exit(1);
			}
			node.credentials[type] = { id: found.id, name: found.name };
		}
	}
}

/**
 * The newest stored execution of a workflow, read-only from n8n's default
 * SQLite database (~/.n8n/database.sqlite, or N8N_USER_FOLDER). Its `data` is
 * in flatted format; n8n ships the parser. Returns null when anything is
 * missing (another database, execution data stored outside the DB, ...).
 */
function openExecutionDb() {
	const userFolder = process.env.N8N_USER_FOLDER ?? os.homedir();
	const dbFile = path.join(userFolder, '.n8n', 'database.sqlite');
	if (!fs.existsSync(dbFile)) return null;
	const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
	return new DatabaseSync(dbFile, { readOnly: true });
}

function lastExecutionId() {
	try {
		const db = openExecutionDb();
		if (!db) return 0;
		const row = db.prepare('SELECT MAX(id) AS id FROM execution_entity').get();
		db.close();
		return row?.id ?? 0;
	} catch {
		return 0;
	}
}

function storedExecutionError(workflowId, afterId) {
	try {
		const n8nRoot = globalN8nRoot();
		const db = openExecutionDb();
		if (!db || !n8nRoot) return null;
		const { parse } = createRequire(path.join(n8nRoot, 'package.json'))('flatted');
		const row = db
			.prepare(
				'SELECT e.id, e.status, d.data FROM execution_entity e JOIN execution_data d ON d.executionId = e.id WHERE e.workflowId = ? AND e.id > ? ORDER BY e.id DESC LIMIT 1',
			)
			.get(workflowId, afterId);
		db.close();
		if (!row) return null;
		const error = parse(row.data)?.resultData?.error;
		if (!error) return null;
		return { id: row.id, status: row.status, message: `${error.name ?? 'Error'}: ${error.message}` };
	} catch {
		return null;
	}
}

const wfFile = path.join(work, 'workflow.json');
fs.writeFileSync(wfFile, JSON.stringify([workflow]));
const imported = n8n(['import:workflow', `--input="${wfFile}"`]);
if (imported.status !== 0) {
	console.error(`import failed:\n${imported.stdout}${imported.stderr}`);
	process.exit(1);
}

const env = {};
const httpLog = path.join(work, 'http.log');
if (flags['count-http']) {
	const counter = path.join(SKILL_DIR, 'templates', 'test', 'e2e', 'http-counter.cjs').replace(/\\/g, '/');
	// Keep any NODE_OPTIONS already set (e.g. another --require).
	env.NODE_OPTIONS = [process.env.NODE_OPTIONS, `--require "${counter}"`].filter(Boolean).join(' ');
	env.E2E_HTTP_LOG = httpLog;
	if (typeof flags.headers === 'string') env.E2E_HTTP_HEADERS = flags.headers;
}
if (flags.debug) env.N8N_LOG_LEVEL = 'debug';

const executionsBefore = lastExecutionId();
const started = Date.now();
const run = n8n(['execute', '--id', workflow.id, '--rawOutput'], env);
const wallMs = Date.now() - started;
// With N8N_LOG_LEVEL=debug, n8n prints the execution JSON through its logger,
// with ANSI colour codes around every line - strip them before parsing.
const plainOutput = run.stdout.replace(/\x1b\[[0-9;]*m/g, '');
const execution = extractJsonObject(plainOutput, (v) => v && typeof v === 'object' && 'status' in v && 'data' in v);

const summary = { workflowId: workflow.id, wallMs, status: execution?.status ?? 'unknown', nodes: [], http: [], debug: [] };
if (!execution) {
	// A workflow that fails n8n's pre-run checks (e.g. a parameter failing its
	// validation regex: WorkflowHasIssuesError) only prints "No active
	// execution found". The real error is in the stored execution record.
	const stored = storedExecutionError(workflow.id, executionsBefore);
	if (stored) {
		summary.status = stored.status;
		summary.error = `${stored.message} (stored execution ${stored.id}; n8n printed only "No active execution found")`;
	} else {
		summary.error =
			'No execution JSON in the output. Last lines:\n' +
			`${run.stdout}\n${run.stderr}`.trim().split('\n').slice(-15).join('\n');
	}
} else {
	const runData = execution.data?.resultData?.runData ?? {};
	for (const [name, runs] of Object.entries(runData)) {
		const last = runs.at(-1);
		const items = last.data?.main?.[0] ?? [];
		summary.nodes.push({
			name,
			runs: runs.length,
			executionTime: last.executionTime,
			items: items.length,
			error: last.error ? `${last.error.message}${last.error.httpCode ? ` (HTTP ${last.error.httpCode})` : ''}` : undefined,
			firstItem: items[0]?.json,
			pairedItems: items.slice(0, 5).map((i) => i.pairedItem),
		});
	}
	const topError = execution.data?.resultData?.error;
	if (topError) summary.error = `${topError.message}${topError.node?.name ? ` (node "${topError.node.name}")` : ''}`;
}

if (flags['count-http'] && fs.existsSync(httpLog)) {
	const [host, ...rest] = String(flags['count-http']).split('/');
	const prefix = rest.length ? '/' + rest.join('/') : '/';
	const calls = fs
		.readFileSync(httpLog, 'utf8')
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line))
		.filter((c) => c.host === host && c.path.startsWith(prefix));
	summary.http = calls.map((c, i) => ({ ...c, sincePreviousMs: i ? c.t - calls[i - 1].t : 0 }));
}
if (flags.debug) {
	summary.debug = `${run.stdout}\n${run.stderr}`
		.split('\n')
		.filter((l) => /Running node "|Start executing node "/.test(l))
		.map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/\s*\{.*\}\s*$/, '').trim());
}

fs.rmSync(work, { recursive: true, force: true });

if (flags.json) {
	console.log(JSON.stringify(summary, null, 2));
} else {
	console.log(`status: ${summary.status}   (workflow ${summary.workflowId}, ${wallMs} ms wall clock)`);
	if (summary.error) console.log(`error: ${summary.error}`);
	for (const n of summary.nodes) {
		console.log(`\n## ${n.name}: ${n.error ? 'ERROR ' + n.error : `${n.items} item(s)`}, ${n.executionTime} ms, ${n.runs} run(s)`);
		if (n.firstItem) console.log(`   first item: ${JSON.stringify(n.firstItem).slice(0, 200)}`);
		if (n.items) console.log(`   pairedItem (first 5): ${JSON.stringify(n.pairedItems)}`);
	}
	if (flags['count-http']) {
		console.log(`\nHTTP calls to ${flags['count-http']}: ${summary.http.length}`);
		for (const c of summary.http) {
			console.log(`   +${String(c.sincePreviousMs).padStart(5)} ms  ${c.method} ${c.host}${c.path}`);
			for (const [name, value] of Object.entries(c.headers ?? {})) console.log(`            ${name}: ${value}`);
		}
	}
	if (flags.debug) {
		console.log('\nPer-attempt node log lines:');
		for (const line of summary.debug) console.log(`   ${line}`);
	}
	console.log(
		'\nNote: runs = node runs, not Retry On Fail attempts. Use --count-http or --debug to see attempts.',
	);
}
process.exit(summary.status === 'success' ? 0 : 1);
