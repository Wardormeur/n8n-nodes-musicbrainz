import type { IExecuteSingleFunctions, INodeProperties } from 'n8n-workflow';

import { ENTITIES, camel } from '../actions/entities';
import { fieldOptions, includeOptions } from '../actions/operations';
import { escapeLucene, setBrowseQs, setIncludeQs } from '../actions/query';
import { listSearchMethods, toItem } from '../methods/listSearch';
import { MusicBrainz } from '../MusicBrainz.node';

const node = new MusicBrainz();
const ID = '5b11f4ce-a62d-471e-81fc-a69a8278c7da';
const entity = (value: string) => ENTITIES.find((e) => e.value === value)!;

// Resolves dotted paths like n8n does (lodash get).
function contextWith(parameters: Record<string, unknown>) {
	return {
		getNodeParameter: (name: string, fallback: unknown) => {
			const value = name
				.split('.')
				.reduce<unknown>((obj, key) => (obj as Record<string, unknown> | undefined)?.[key], parameters);
			return value === undefined ? fallback : value;
		},
	} as unknown as IExecuteSingleFunctions;
}

describe('escapeLucene', () => {
	it('leaves plain words alone and escapes query syntax', () => {
		expect(escapeLucene('The Beatles')).toBe('The Beatles');
		expect(escapeLucene('AC/DC')).toBe('AC\\/DC');
		expect(escapeLucene('Sunn O)))')).toBe('Sunn O\\)\\)\\)');
		expect(escapeLucene('artist:"x"')).toBe('artist\\:\\"x\\"');
	});
});

describe('setBrowseQs', () => {
	it('uses the linked entity type as the query key', async () => {
		const options = await setBrowseQs.call(
			contextWith({ linkedTo: 'release-group', linkedId: ` ${ID} ` }),
			{ url: '/artist', qs: { limit: 5 } },
		);
		expect(options.qs).toEqual({ limit: 5, 'release-group': ID });
	});

	it('adds type and status filters joined with |, only when set', async () => {
		const options = await setBrowseQs.call(
			contextWith({ linkedTo: 'artist', linkedId: ID, browseFilters: { type: ['album', 'ep'], status: [] } }),
			{ url: '/release' },
		);
		expect(options.qs).toEqual({ artist: ID, type: 'album|ep' });
	});
});

describe('setIncludeQs', () => {
	it('sends no inc when nothing is selected', async () => {
		const options = await setIncludeQs.call(contextWith({}), { url: '/artist/x', qs: {} });
		expect(options.qs).toEqual({});
	});

	it('joins the selection with spaces', async () => {
		const options = await setIncludeQs.call(contextWith({ options: { include: ['aliases', 'url-rels'] } }), {
			url: '/artist/x',
		});
		expect(options.qs).toEqual({ inc: 'aliases url-rels' });
	});
});

// n8n validates a mode as ^<regex>$ and extracts with the unanchored regex.
function urlMode(value: string) {
	const locator = node.description.properties.find(
		(p) => p.name === `${camel(value)}Id` && p.type === 'resourceLocator',
	) as INodeProperties;
	const mode = locator.modes!.find((m) => m.name === 'url')!;
	const validation = (mode.validation![0] as { properties: { regex: string } }).properties.regex;
	const extract = (mode.extractValue as { regex: string }).regex;
	return {
		validates: (url: string) => new RegExp(`^${validation}$`).test(url),
		extract: (url: string) => new RegExp(extract).exec(url)?.[1],
	};
}

describe('resource locator URLs, every entity', () => {
	it.each(ENTITIES.map((e) => e.value))('%s: accepts its own URL shapes and extracts the MBID', (value) => {
		for (const url of [
			`https://musicbrainz.org/${value}/${ID}`,
			`https://beta.musicbrainz.org/${value}/${ID}/relationships`,
			`https://musicbrainz.org/${value}/${ID}?tab=1`,
		]) {
			expect(urlMode(value).validates(url)).toBe(true);
			expect(urlMode(value).extract(url)).toBe(ID);
		}
	});

	it('rejects another entity type and malformed IDs', () => {
		expect(urlMode('release').validates(`https://musicbrainz.org/release-group/${ID}`)).toBe(false);
		expect(urlMode('artist').validates('https://musicbrainz.org/artist/not-an-id')).toBe(false);
		expect(urlMode('work').validates(`https://example.org/work/${ID}`)).toBe(false);
	});
});

describe('node description', () => {
	const props = node.description.properties;

	it('has the 11 entities as resources, each with Get, Get Many and Search, all GET', () => {
		const resources = (props.find((p) => p.name === 'resource')!.options as Array<{ value: string }>).map((o) => o.value);
		expect(resources).toHaveLength(11);
		for (const value of resources) {
			const operation = props.find((p) => p.name === 'operation' && p.displayOptions?.show?.resource?.[0] === value)!;
			const options = operation.options as Array<{ value: string; routing: { request: { method: string } } }>;
			expect(options.map((o) => o.value)).toEqual(['get', 'getAll', 'search']);
			expect(new Set(options.map((o) => o.routing.request.method))).toEqual(new Set(['GET']));
		}
	});

	it('offers browse links per the MusicBrainz linked-entities table', () => {
		const linked = (value: string) =>
			((
				props.find((p) => p.name === 'linkedTo' && p.displayOptions?.show?.resource?.[0] === value)!.options as Array<{ value: string }>
			).map((o) => o.value));
		expect(linked('release')).toEqual(['area', 'artist', 'collection', 'label', 'recording', 'release-group', 'track', 'track_artist']);
		expect(linked('label')).toEqual(['area', 'collection', 'release']);
		expect(linked('series')).toEqual(['collection']);
	});

	it('has a list-search method for every resource locator', () => {
		for (const e of ENTITIES) {
			const locator = props.find((p) => p.name === `${camel(e.value)}Id`)!;
			const method = (locator.modes![0].typeOptions as { searchListMethod: string }).searchListMethod;
			expect(listSearchMethods[method]).toBeInstanceOf(Function);
		}
	});
});

describe('include and field options', () => {
	const values = (value: string) => includeOptions(entity(value)).map((o) => o.value);

	it('offers ratings only for rateable entities', () => {
		expect(values('artist')).toContain('ratings');
		expect(values('series')).not.toContain('ratings');
		expect(values('release')).not.toContain('ratings');
	});

	it('offers entity-specific subqueries and every relationship type', () => {
		expect(values('release')).toEqual(expect.arrayContaining(['labels', 'recordings', 'media', 'discids', 'url-rels', 'artist-rels']));
		expect(values('area')).not.toContain('recordings');
	});

	it("keeps 'id' out of Selected Fields (it's always included)", () => {
		expect(fieldOptions(entity('work')).map((o) => o.value)).not.toContain('id');
	});
});

describe('picker entries', () => {
	it('labels with disambiguation, and date for releases', () => {
		expect(toItem(entity('artist'), { id: ID, name: 'Nirvana', disambiguation: 'US grunge band' })).toEqual({
			name: 'Nirvana (US grunge band)',
			value: ID,
			url: `https://musicbrainz.org/artist/${ID}`,
		});
		expect(toItem(entity('release'), { id: ID, title: 'Nevermind', date: '1991-09-24' }).name).toBe('Nevermind (1991-09-24)');
	});
});
