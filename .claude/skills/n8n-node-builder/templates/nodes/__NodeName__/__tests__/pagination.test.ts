import type {
	DeclarativeRestApiSettings,
	IExecutePaginationFunctions,
	INodeExecutionData,
} from 'n8n-workflow';
import { buildReturnAllProperties, paginateWithDelay } from '../actions/pagination';

describe('buildReturnAllProperties', () => {
	const show = { resource: ['thing'], operation: ['getMany'] };

	it('routes Limit to `limit` by default', () => {
		const [, limit] = buildReturnAllProperties(show);
		expect(limit.routing?.request?.qs).toEqual({ limit: '={{$value}}' });
	});

	it("routes Limit to the API's page-size parameter", () => {
		const [returnAll, limit] = buildReturnAllProperties(show, { limitParameter: 'per_page' });
		expect(returnAll.routing?.send?.paginate).toBe('={{$value}}');
		expect(limit.routing?.request?.qs).toEqual({ per_page: '={{$value}}' });
		expect(limit.displayOptions?.show).toEqual({ ...show, returnAll: [false] });
	});
});

/** A fake API with `total` entities, served in pages per the request's limit/offset. */
function fakeApi(total: number) {
	const requests: Array<{ limit: number; offset: number }> = [];
	const context = {
		makeRoutingRequest: async (
			requestData: DeclarativeRestApiSettings.ResultOptions,
		): Promise<INodeExecutionData[]> => {
			const { limit, offset } = requestData.options.qs as { limit: number; offset: number };
			requests.push({ limit, offset });
			const count = Math.max(0, Math.min(limit, total - offset));
			return Array.from({ length: count }, (_, i) => ({ json: { id: `e${offset + i}` } }));
		},
	} as unknown as IExecutePaginationFunctions;
	return { context, requests };
}

const request = (): DeclarativeRestApiSettings.ResultOptions => ({
	options: { url: '/items', qs: { fmt: 'json', query: 'x' } },
	preSend: [],
	postReceive: [],
});

describe('paginateWithDelay', () => {
	it('fetches pages until a short page, keeping the other query params', async () => {
		const { context, requests } = fakeApi(104);
		const result = await paginateWithDelay(100, 0).call(context, request());
		expect(result).toHaveLength(104);
		expect(requests).toEqual([
			{ limit: 100, offset: 0 },
			{ limit: 100, offset: 100 },
		]);
		expect(result[103].json.id).toBe('e103');
	});

	it('makes one request when everything fits in the first page', async () => {
		const { context, requests } = fakeApi(41);
		const result = await paginateWithDelay(100, 0).call(context, request());
		expect(result).toHaveLength(41);
		expect(requests).toHaveLength(1);
	});

	it('makes one extra, empty request when the total is an exact multiple of the page size', async () => {
		const { context, requests } = fakeApi(200);
		const result = await paginateWithDelay(100, 0).call(context, request());
		expect(result).toHaveLength(200);
		expect(requests.map((r) => r.offset)).toEqual([0, 100, 200]);
	});

	it('handles an empty result', async () => {
		const { context, requests } = fakeApi(0);
		await expect(paginateWithDelay(100, 0).call(context, request())).resolves.toEqual([]);
		expect(requests).toHaveLength(1);
	});

	it('pages by page number with custom parameter names (page style)', async () => {
		const requests: Array<Record<string, unknown>> = [];
		const total = 230;
		const context = {
			makeRoutingRequest: async (
				requestData: DeclarativeRestApiSettings.ResultOptions,
			): Promise<INodeExecutionData[]> => {
				const qs = requestData.options.qs as { per_page: number; page: number };
				requests.push({ ...qs });
				const start = (qs.page - 1) * qs.per_page;
				const count = Math.max(0, Math.min(qs.per_page, total - start));
				return Array.from({ length: count }, (_, i) => ({ json: { id: `e${start + i}` } }));
			},
		} as unknown as IExecutePaginationFunctions;

		const result = await paginateWithDelay(100, 0, {
			style: 'page',
			limitParameter: 'per_page',
		}).call(context, request());

		expect(result).toHaveLength(230);
		expect(result[229].json.id).toBe('e229');
		expect(requests).toEqual([
			{ fmt: 'json', query: 'x', per_page: 100, page: 1 },
			{ fmt: 'json', query: 'x', per_page: 100, page: 2 },
			{ fmt: 'json', query: 'x', per_page: 100, page: 3 },
		]);
	});

	it('untilEmpty: follows short pages mid-list by the records returned', async () => {
		// Pages of at most 40 even when 100 are asked for, 90 records in total.
		const requests: Array<{ limit: number; offset: number }> = [];
		const context = {
			makeRoutingRequest: async (
				requestData: DeclarativeRestApiSettings.ResultOptions,
			): Promise<INodeExecutionData[]> => {
				const { limit, offset } = requestData.options.qs as { limit: number; offset: number };
				requests.push({ limit, offset });
				const count = Math.max(0, Math.min(limit, 40, 90 - offset));
				return Array.from({ length: count }, (_, i) => ({ json: { id: `e${offset + i}` } }));
			},
		} as unknown as IExecutePaginationFunctions;

		const result = await paginateWithDelay(100, 0, { untilEmpty: true }).call(context, request());

		expect(result).toHaveLength(90);
		expect(new Set(result.map((r) => r.json.id)).size).toBe(90);
		expect(requests.map((r) => r.offset)).toEqual([0, 40, 80, 90]);
	});

	it('without untilEmpty, a short page ends the list (the default)', async () => {
		const requests: number[] = [];
		const context = {
			makeRoutingRequest: async (
				requestData: DeclarativeRestApiSettings.ResultOptions,
			): Promise<INodeExecutionData[]> => {
				const { offset } = requestData.options.qs as { offset: number };
				requests.push(offset);
				return Array.from({ length: offset === 0 ? 40 : 0 }, (_, i) => ({ json: { id: `e${i}` } }));
			},
		} as unknown as IExecutePaginationFunctions;
		await paginateWithDelay(100, 0).call(context, request());
		expect(requests).toEqual([0]);
	});

	it('waits between pages but not after the last one', async () => {
		const { context } = fakeApi(250);
		const started = Date.now();
		await paginateWithDelay(100, 50).call(context, request());
		const elapsed = Date.now() - started;
		// 3 pages -> 2 pauses of 50 ms
		expect(elapsed).toBeGreaterThanOrEqual(95);
		expect(elapsed).toBeLessThan(140);
	});
});
