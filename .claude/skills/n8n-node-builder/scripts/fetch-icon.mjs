#!/usr/bin/env node
// Write a node's light and dark icons from the service's real logo, taken
// from Simple Icons (https://simpleicons.org: single-path brand SVGs with
// the brand colour and the source of the logo).
//
//   node fetch-icon.mjs --slug <simple-icons slug> --dir <node dir> --name <file base>
//        [--version <simple-icons version>] [--search <text>]
//
// --slug     e.g. discogs, musicbrainz (see https://simpleicons.org)
// --dir      the node folder, e.g. nodes/Discogs
// --name     file base: writes <name>.svg (light theme) and <name>.dark.svg
// --version  pin a Simple Icons release (default: the current npm version)
// --search   list icons whose title contains <text>, to find a slug
//
// Colours: the light-theme icon uses the brand colour unless it's too light
// to read on white (then #333333); the dark-theme icon uses the brand colour
// unless it's too dark to read on n8n's dark canvas (then #FFFFFF).
// Prints the version, brand colour and logo source to put in the README.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib.mjs';

const { flags } = parseArgs();

async function latestVersion() {
	const res = await fetch('https://registry.npmjs.org/simple-icons/latest');
	if (!res.ok) throw new Error(`npm registry: HTTP ${res.status}`);
	return (await res.json()).version;
}

async function iconData(version) {
	// The metadata file moved between releases; try both locations.
	for (const file of ['data/simple-icons.json', '_data/simple-icons.json']) {
		const res = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@${version}/${file}`);
		if (res.ok) {
			const data = await res.json();
			return Array.isArray(data) ? data : data.icons;
		}
	}
	throw new Error(`no metadata file found for simple-icons@${version}`);
}

// Simple Icons' own slug rule for titles without an explicit slug.
const slugOf = (icon) =>
	icon.slug ??
	icon.title
		.toLowerCase()
		.replace(/\+/g, 'plus')
		.replace(/\./g, 'dot')
		.replace(/&/g, 'and')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]/g, '');

function luminance(hex) {
	const [r, g, b] = [0, 2, 4].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const version = typeof flags.version === 'string' ? flags.version : await latestVersion();
const icons = await iconData(version);

if (typeof flags.search === 'string') {
	const text = flags.search.toLowerCase();
	const hits = icons.filter((i) => i.title.toLowerCase().includes(text));
	console.log(`simple-icons ${version}: ${hits.length} match(es)`);
	for (const i of hits) console.log(`  ${slugOf(i).padEnd(24)} ${i.title}  #${i.hex}`);
	process.exit(0);
}

for (const required of ['slug', 'dir', 'name']) {
	if (typeof flags[required] !== 'string') {
		console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 20).join('\n'));
		process.exit(1);
	}
}

const icon = icons.find((i) => slugOf(i) === flags.slug);
if (!icon) {
	const near = icons.filter((i) => slugOf(i).includes(flags.slug.slice(0, 4))).slice(0, 8);
	console.error(`No icon "${flags.slug}" in simple-icons ${version}.`);
	if (near.length) console.error(`Close: ${near.map((i) => slugOf(i)).join(', ')}`);
	console.error('Some brands are not in Simple Icons (or were removed at their request).');
	console.error('Do not draw a placeholder: ask the user for the logo (an SVG, or a 60x60 PNG) and its light/dark variants.');
	process.exit(1);
}

const res = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@${version}/icons/${flags.slug}.svg`);
if (!res.ok) throw new Error(`icon file: HTTP ${res.status}`);
const svg = await res.text();
const pathTag = svg.match(/<path\b[^>]*\/>/)?.[0];
if (!pathTag) throw new Error('unexpected SVG: no single <path/>');

const brand = icon.hex.toUpperCase();
const light = luminance(brand) > 0.8 ? '333333' : brand;
const dark = luminance(brand) < 0.08 ? 'FFFFFF' : brand;
const comment = `Logo from Simple Icons ${version} (simpleicons.org; source ${icon.source ?? 'n/a'}).`;
// A function replacement, so "$" sequences in the path data stay literal.
const variant = (fill) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60">\n\t<!-- ${comment} -->\n\t${pathTag.replace('<path ', () => `<path fill="#${fill}" `)}\n</svg>\n`;

const dir = path.resolve(flags.dir);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `${flags.name}.svg`), variant(light));
fs.writeFileSync(path.join(dir, `${flags.name}.dark.svg`), variant(dark));
console.log(`Wrote ${flags.name}.svg (#${light}) and ${flags.name}.dark.svg (#${dark}) in ${dir}`);
console.log(`For the README: ${icon.title} logo from Simple Icons ${version}, brand colour #${brand}, source ${icon.source ?? 'n/a'}.`);
