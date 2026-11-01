#!/usr/bin/env node
// Append to references/sources.json without hand-editing JSON in a shell.
//
//   node sources-add.mjs audit  "<what happened>"   [--date YYYY-MM-DD]
//   node sources-add.mjs lesson "<lesson>"
//   node sources-add.mjs gap    "<known gap>"
//   node sources-add.mjs audit  @notes.txt          (read the text from a file)
//   node sources-add.mjs touch  last_full_refresh|source_code_references|templates [--date ...]
//
// Text from a file (@path) avoids shell-quoting problems with apostrophes,
// backticks and $ in the text.
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_DIR, parseArgs } from './lib.mjs';

const { flags, positional } = parseArgs();
const [kind, raw] = positional;
const file = path.join(SKILL_DIR, 'references', 'sources.json');
const sources = JSON.parse(fs.readFileSync(file, 'utf8'));
const date = typeof flags.date === 'string' ? flags.date : new Date().toISOString().slice(0, 10);
const text = raw?.startsWith('@') ? fs.readFileSync(raw.slice(1), 'utf8').trim() : raw;

switch (kind) {
	case 'audit':
		if (!text) throw new Error('audit needs text');
		(sources.audit_history ??= []).push({ date, what_happened: text });
		break;
	case 'lesson':
		if (!text) throw new Error('lesson needs text');
		(sources.lessons_from_past_refresh_mistakes ??= []).push(text);
		break;
	case 'gap':
		if (!text) throw new Error('gap needs text');
		(sources.known_gaps ??= []).push(text);
		break;
	case 'touch':
		if (raw === 'last_full_refresh') sources.last_full_refresh = date;
		else if (raw === 'source_code_references') sources.source_code_references.last_verified = date;
		else if (raw === 'templates') sources.templates.last_verified = date;
		else throw new Error('touch: last_full_refresh | source_code_references | templates');
		break;
	default:
		console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 12).join('\n'));
		process.exit(1);
}
fs.writeFileSync(file, JSON.stringify(sources, null, 2) + '\n');
console.log(`sources.json: ${kind} recorded (${date})`);
