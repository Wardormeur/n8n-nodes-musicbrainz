import type {
	IExecuteSingleFunctions,
	IGetNodeParameterOptions,
	ILoadOptionsFunctions,
	INodePropertyModeTypeOptions,
} from 'n8n-workflow';

import { buildResourceLocator, createListSearch, setUrlFromLocator } from '../actions/resourceLocator';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const locatorOptions = () => ({
	name: 'thingId',
	displayName: 'Thing',
	description: 'The thing to get',
	show: { resource: ['thing'], operation: ['get'] },
	searchListMethod: 'searchThings',
	idRegex: UUID,
	idPlaceholder: 'e.g. 00000000-0000-0000-0000-000000000000',
	idErrorMessage: 'Enter a thing ID',
	urlRegex: `https?://example\\.com/thing/(${UUID})`,
	urlPlaceholder: 'e.g. https://example.com/thing/00000000-0000-0000-0000-000000000000',
	urlErrorMessage: 'Enter an example.com thing URL',
});

const locator = buildResourceLocator(locatorOptions());

describe('buildResourceLocator', () => {
	it('has list, id and url modes, defaulting to list', () => {
		expect(locator.type).toBe('resourceLocator');
		expect(locator.default).toEqual({ mode: 'list', value: '' });
		expect(locator.modes?.map((mode) => mode.name)).toEqual(['list', 'id', 'url']);
		expect((locator.modes?.[0].typeOptions as INodePropertyModeTypeOptions).searchListMethod).toBe(
			'searchThings',
		);
	});

});

// The two ways n8n uses these regexes (n8n-workflow node-helpers.js
// validateResourceLocatorParameter; n8n-core utils/extract-value.js):
// validation tests ^<regex>$ against the whole value, extractValue runs the
// regex unanchored and needs exactly one capture group.
const ID = '5b11f4ce-a62d-471e-81fc-a69a8278c7da';

function mode(name: string) {
	const found = locator.modes?.find((m) => m.name === name);
	const validation = found?.validation?.[0] as { properties: { regex: string } } | undefined;
	return {
		validates: (value: string) => new RegExp(`^${validation?.properties.regex}$`).test(value),
		extract: (value: string) => {
			const regex = (found?.extractValue as { regex: string } | undefined)?.regex ?? '';
			return new RegExp(regex).exec(value);
		},
	};
}

describe('By URL mode, as n8n validates and extracts it', () => {
	it.each([
		`https://example.com/thing/${ID}`,
		`http://example.com/thing/${ID}/`,
		`https://example.com/thing/${ID}/details`,
		`https://example.com/thing/${ID}?tab=1`,
		`https://example.com/thing/${ID}#top`,
	])('accepts %s and extracts the ID', (url) => {
		expect(mode('url').validates(url)).toBe(true);
		const match = mode('url').extract(url);
		expect(match).toHaveLength(2);
		expect(match?.[1]).toBe(ID);
	});

	it.each([
		`https://example.com/other/${ID}`,
		`https://evil.example.org/thing/${ID}`,
		`https://example.com/thing/not-an-id`,
		`https://example.com/thing/${ID}x`,
		`see https://example.com/thing/${ID}`,
	])('rejects %s', (url) => {
		expect(mode('url').validates(url)).toBe(false);
	});

	it('takes a stricter urlTail when the default is wrong for a service', () => {
		const strict = buildResourceLocator({
			...locatorOptions(),
			urlTail: '/?',
		});
		const url = strict.modes?.find((m) => m.name === 'url');
		const regex = (url?.validation?.[0] as { properties: { regex: string } }).properties.regex;
		expect(new RegExp(`^${regex}$`).test(`https://example.com/thing/${ID}/`)).toBe(true);
		expect(new RegExp(`^${regex}$`).test(`https://example.com/thing/${ID}?tab=1`)).toBe(false);
	});
});

describe('By ID mode, as n8n validates it', () => {
	it('accepts a bare ID and rejects anything around it', () => {
		expect(mode('id').validates(ID)).toBe(true);
		expect(mode('id').validates(` ${ID}`)).toBe(false);
		expect(mode('id').validates(`${ID}/`)).toBe(false);
	});

	it('keeps an alternation in idRegex anchored as a whole', () => {
		const either = buildResourceLocator({ ...locatorOptions(), idRegex: '[0-9]+|[a-z]+' });
		const id = either.modes?.find((m) => m.name === 'id');
		const regex = (id?.validation?.[0] as { properties: { regex: string } }).properties.regex;
		expect(new RegExp(`^${regex}$`).test('123')).toBe(true);
		expect(new RegExp(`^${regex}$`).test('123abc')).toBe(false);
	});
});

describe('setUrlFromLocator', () => {
	it('builds the URL from the extracted value, not the raw locator', async () => {
		const seen: Array<IGetNodeParameterOptions | undefined> = [];
		const context = {
			getNodeParameter: (_name: string, _fallback: unknown, options?: IGetNodeParameterOptions) => {
				seen.push(options);
				return options?.extractValue ? ' abc ' : 'https://example.com/thing/abc';
			},
		} as unknown as IExecuteSingleFunctions;

		const options = await setUrlFromLocator('thingId', (id) => `/thing/${id}`).call(context, {
			url: '',
		});

		expect(seen[0]).toEqual({ extractValue: true });
		expect(options.url).toBe('/thing/abc');
	});
});

// A `this` that fails the test if anything on it is touched.
const untouchable = new Proxy(
	{},
	{
		get(_target, key) {
			throw new Error(`listSearch touched this.${String(key)}`);
		},
	},
) as ILoadOptionsFunctions;

function contextReturning(response: object) {
	const calls: Array<{ credential: string; options: { qs: Record<string, unknown> } }> = [];
	const context = {
		helpers: {
			httpRequestWithAuthentication: async (credential: string, options: never) => {
				calls.push({ credential, options });
				return response;
			},
		},
	} as unknown as ILoadOptionsFunctions;
	return { context, calls };
}

const searchThings = (pageSize?: number) =>
	createListSearch({
		credentialType: 'exampleApi',
		url: 'https://example.com/api/thing',
		searchQs: (filter) => ({ query: filter }),
		listKey: 'things',
		toItem: (thing) => ({ name: thing.name as string, value: thing.id as string }),
		pageSize,
	});

describe('createListSearch', () => {
	it.each([undefined, '', '   '])('returns no results without a request for filter %p', async (filter) => {
		await expect(searchThings().call(untouchable, filter)).resolves.toEqual({ results: [] });
	});

	it('maps records and returns the next offset after a full page', async () => {
		const { context, calls } = contextReturning({
			things: [
				{ id: 'a', name: 'A' },
				{ id: 'b', name: 'B' },
			],
		});

		const result = await searchThings(2).call(context, ' x ');

		expect(calls[0].credential).toBe('exampleApi');
		expect(calls[0].options.qs).toEqual({ query: 'x', limit: 2, offset: 0 });
		expect(result.results).toEqual([
			{ name: 'A', value: 'a' },
			{ name: 'B', value: 'b' },
		]);
		expect(result.paginationToken).toBe('2');
	});

	it('continues from the token and stops after a short page', async () => {
		const { context, calls } = contextReturning({ things: [{ id: 'c', name: 'C' }] });

		const result = await searchThings(2).call(context, 'x', '2');

		expect(calls[0].options.qs.offset).toBe(2);
		expect(result.paginationToken).toBeUndefined();
	});

	it('pages by page number, passing the next page as the token', async () => {
		const byPage = createListSearch({
			credentialType: 'exampleApi',
			url: 'https://example.com/api/search',
			searchQs: (filter) => ({ q: filter }),
			listKey: 'results',
			toItem: (thing) => ({ name: thing.title as string, value: String(thing.id) }),
			pageSize: 2,
			paging: 'page',
			limitParameter: 'per_page',
		});
		const first = contextReturning({ results: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }] });
		const firstResult = await byPage.call(first.context, 'x');
		expect(first.calls[0].options.qs).toEqual({ q: 'x', per_page: 2, page: 1 });
		expect(firstResult.paginationToken).toBe('2');

		const second = contextReturning({ results: [{ id: 3, title: 'C' }] });
		const secondResult = await byPage.call(second.context, 'x', firstResult.paginationToken);
		expect(second.calls[0].options.qs).toEqual({ q: 'x', per_page: 2, page: 2 });
		expect(secondResult.paginationToken).toBeUndefined();
	});

	it('sends no paging parameters when pageSize is 0', async () => {
		const { context, calls } = contextReturning({ things: [] });

		await searchThings(0).call(context, 'x');

		expect(calls[0].options.qs).toEqual({ query: 'x' });
	});
});
