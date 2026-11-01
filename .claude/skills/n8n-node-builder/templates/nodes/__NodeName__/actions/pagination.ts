import { sleep } from 'n8n-workflow';
import type {
	DeclarativeRestApiSettings,
	IExecutePaginationFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

// Set to the API's maximum results per request.
export const PAGE_SIZE = 100;
// Pause between page requests. n8n's built-in `offset` pagination sends pages
// back to back (batching only spaces out input items), so a rate-limited API
// needs this function instead. Set it from the API's rate limit.
export const PAGE_DELAY_MS = 1000;

type Show = { resource: string[]; operation: string[] };

/**
 * How the API pages. `offset` (the default): `limit` + `offset` (record index).
 * `page`: a page size + a page number, e.g. Discogs `per_page` + `page`.
 */
export interface PagingOptions {
	style?: 'offset' | 'page';
	/** Page-size query parameter. Default 'limit'. */
	limitParameter?: string;
	/** Offset query parameter (offset style). Default 'offset'. */
	offsetParameter?: string;
	/** Page-number query parameter (page style). Default 'page'. */
	pageParameter?: string;
	/** Number of the first page (page style). Default 1. */
	firstPage?: number;
	/**
	 * Offset style only: for APIs that can return a short page before the end
	 * (e.g. MusicBrainz release browse caps a page at 500 tracks), advance the
	 * offset by the records actually returned and stop only on an empty page.
	 * Costs one extra, empty request at the end.
	 */
	untilEmpty?: boolean;
}

/** "Return All" + "Limit", the n8n convention for list operations. */
export function buildReturnAllProperties(show: Show, paging: PagingOptions = {}): INodeProperties[] {
	const limitParameter = paging.limitParameter ?? 'limit';
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			displayOptions: { show },
			description: 'Whether to return all results or only up to a given limit',
			// Turns on the operation's routing.operations.pagination
			routing: { send: { paginate: '={{$value}}' } },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			default: 50,
			typeOptions: { minValue: 1, maxValue: PAGE_SIZE },
			displayOptions: { show: { ...show, returnAll: [false] } },
			description: 'Max number of results to return',
			routing: {
				request: { qs: { [limitParameter]: '={{$value}}' } },
				output: { maxResults: '={{$value}}' },
			},
		},
	];
}

/**
 * routing.operations.pagination for list endpoints: requests successive pages
 * until a short page comes back, waiting `delayMs` between requests.
 * makeRoutingRequest runs the operation's postReceive hooks, so each page
 * arrives already split into one item per entity, and its length is the
 * number of entities on the page.
 */
export function paginateWithDelay(
	pageSize = PAGE_SIZE,
	delayMs = PAGE_DELAY_MS,
	paging: PagingOptions = {},
) {
	const style = paging.style ?? 'offset';
	const limitParameter = paging.limitParameter ?? 'limit';
	const offsetParameter = paging.offsetParameter ?? 'offset';
	const pageParameter = paging.pageParameter ?? 'page';
	const firstPage = paging.firstPage ?? 1;
	return async function (
		this: IExecutePaginationFunctions,
		requestData: DeclarativeRestApiSettings.ResultOptions,
	): Promise<INodeExecutionData[]> {
		const untilEmpty = style === 'offset' && paging.untilEmpty === true;
		const results: INodeExecutionData[] = [];
		let offset = 0;
		for (let index = 0; ; index++) {
			const position =
				style === 'page'
					? { [pageParameter]: firstPage + index }
					: { [offsetParameter]: offset };
			requestData.options.qs = { ...requestData.options.qs, [limitParameter]: pageSize, ...position };
			const page = await this.makeRoutingRequest(requestData);
			results.push(...page);
			const done = untilEmpty ? page.length === 0 : page.length < pageSize;
			if (done) {
				return results;
			}
			offset += untilEmpty ? page.length : pageSize;
			await sleep(delayMs);
		}
	};
}
