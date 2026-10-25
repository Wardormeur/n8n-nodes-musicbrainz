// Generates test/fixtures/all-entities.json, a self-checking fixture (see
// checks.cjs): Get by ID for every entity (this also checks each entity's
// example MBID), plus Search, Get Many with filters, and a Return All release
// browse. Wait nodes space the calls: MusicBrainz allows about one request
// per second. Run with `npm run test:fixtures -- all-entities.json`, or
//   node <skill>/scripts/n8n-run.mjs test/fixtures/all-entities.json --count-http musicbrainz.org/ws/2/
const path = require('path');
const { buildChain, check } = require('./checks.cjs');

const ids = {
	area: '6a264f94-6ff1-30b1-9a81-41f7bfabd616',
	artist: '5b11f4ce-a62d-471e-81fc-a69a8278c7da',
	event: '27ba6fd7-60af-4c38-8128-27053c8dc130',
	instrument: 'b3eac5f9-7859-4416-ac39-7154e2e8d348',
	label: '38dc88de-7720-4100-9d5b-3cdc41b0c474',
	place: 'bea135c0-a32e-49be-85fd-9234c73fa0a8',
	recording: 'a71c683a-a4d2-4f03-84e2-63499ae64ed2',
	release: 'b52a8f31-b5ab-34e9-92f4-f5b7110220f0',
	'release-group': '1b022e01-4da6-387b-8658-8678046e4cef',
	series: '117dffca-027e-4f60-8063-91896471603d',
	work: '9840e142-269d-3fa3-9805-041a9235c18a',
};
const camel = (v) => v.replace(/-(\w)/g, (_m, c) => c.toUpperCase());
const rl = (value, mode = 'id') => ({ __rl: true, mode, value });
const ok = (...more) => [check.noError(), ...more];

buildChain({
	id: 'mbFixtureEntities1',
	name: 'MusicBrainz fixture: all entities',
	nodeType: 'CUSTOM.musicBrainz',
	credentials: { musicBrainzApi: 'auto' },
	waitSeconds: 2.5,
	// MusicBrainz answers 503 after a burst even with calls spaced out.
	settings: { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 },
	file: path.join(__dirname, 'all-entities.json'),
	steps: [
		...Object.entries(ids).map(([entity, id]) => ({
			name: `${entity}: Get`,
			parameters: { resource: entity, operation: 'get', [`${camel(entity)}Id`]: rl(id) },
			// The example MBID must come back as the record's ID.
			check: ok(check.count(1), check.expr(`id is ${id}`, `items[0].id === '${id}'`)),
		})),
		{
			name: 'release: Get by URL + includes',
			parameters: { resource: 'release', operation: 'get', releaseId: rl(`https://musicbrainz.org/release/${ids.release}/cover-art`, 'url'), options: { include: ['labels', 'recordings', 'url-rels'] } },
			check: ok(check.count(1), check.hasKeys(['id', 'label-info', 'media', 'relations'])),
		},
		{
			name: 'recording: Search',
			parameters: { resource: 'recording', operation: 'search', query: 'recording:"Smells Like Teen Spirit" AND artist:Nirvana', limit: 3 },
			check: ok(check.count(3), check.hasKeys(['id', 'title'])),
		},
		{
			name: 'release-group: Get Many (albums)',
			parameters: { resource: 'release-group', operation: 'getAll', linkedTo: 'artist', linkedId: ids.artist, browseFilters: { type: ['album'] }, limit: 5 },
			check: ok(check.count(5), check.expr('all albums', "items.every((j) => j['primary-type'] === 'Album')")),
		},
		{
			name: 'release: Get Many (official, Return All)',
			parameters: { resource: 'release', operation: 'getAll', linkedTo: 'release-group', linkedId: ids['release-group'], browseFilters: { status: ['official'] }, returnAll: true },
			// Return All must go past one page (the browse returns short pages).
			check: ok(check.atLeast(26), check.expr('all official', "items.every((j) => j.status === 'Official')")),
		},
		{
			name: 'work: Get Many',
			parameters: { resource: 'work', operation: 'getAll', linkedTo: 'artist', linkedId: ids.artist, limit: 3 },
			check: ok(check.count(3), check.hasKeys(['id', 'title'])),
		},
	],
});
console.log('wrote all-entities.json');
