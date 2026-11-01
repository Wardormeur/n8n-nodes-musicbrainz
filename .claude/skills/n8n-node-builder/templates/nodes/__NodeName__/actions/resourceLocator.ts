import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
	INodeProperties,
} from 'n8n-workflow';

// "Pick a record" parameter (resourceLocator) with From List / By ID / By URL
// modes, the preSend that turns it into a request URL, and a factory for the
// listSearch method behind From List.

type Show = { resource: string[]; operation: string[] };

export interface ResourceLocatorOptions {
	/** Parameter name, e.g. 'artistId'. */
	name: string;
	/** e.g. 'Artist'. */
	displayName: string;
	description: string;
	show: Show;
	/** Key of the method under `methods.listSearch`. */
	searchListMethod: string;
	/** Regex for a bare ID. No ^ or $: n8n anchors validation regexes itself. */
	idRegex: string;
	idPlaceholder: string;
	idErrorMessage: string;
	/**
	 * The service-specific part: the URL of one record, up to and including the
	 * ID. Exactly one capture group: the ID. No ^ or $. Used as-is for
	 * extractValue (unanchored), and with urlTail appended for validation,
	 * which n8n anchors as ^...$ so it must match the whole pasted URL.
	 */
	urlRegex: string;
	/**
	 * What may follow the ID in a pasted URL. Default: nothing, or any path,
	 * query or fragment (`/relationships`, `?tab=1`, `#top`, `/`, `&page=2`
	 * after an ID in the query). Override when the service's IDs could run on
	 * into following characters, e.g. '(?:[/?#].*)?' if an ID can contain '&'.
	 */
	urlTail?: string;
	urlPlaceholder: string;
	urlErrorMessage: string;
}

export const DEFAULT_URL_TAIL = '(?:[/?#&].*)?';

export function buildResourceLocator(options: ResourceLocatorOptions): INodeProperties {
	const urlTail = options.urlTail ?? DEFAULT_URL_TAIL;
	return {
		displayName: options.displayName,
		name: options.name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: options.description,
		displayOptions: { show: options.show },
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Type to search…',
				typeOptions: { searchListMethod: options.searchListMethod, searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: options.idPlaceholder,
				validation: [
					{
						type: 'regex',
						// n8n tests ^<regex>$; the group keeps an alternation inside idRegex whole.
						properties: { regex: `(?:${options.idRegex})`, errorMessage: options.idErrorMessage },
					},
				],
			},
			{
				displayName: 'By URL',
				name: 'url',
				type: 'string',
				placeholder: options.urlPlaceholder,
				validation: [
					{
						type: 'regex',
						properties: {
							regex: `(?:${options.urlRegex})${urlTail}`,
							errorMessage: options.urlErrorMessage,
						},
					},
				],
				// Applied only by getNodeParameter(..., { extractValue: true }).
				// A routing expression ($parameter.x) gets the whole URL instead.
				extractValue: { type: 'regex', regex: options.urlRegex },
			},
		],
	};
}

/**
 * preSend that sets the request URL from a resourceLocator, e.g.
 * `setUrlFromLocator('artistId', (id) => `/artist/${id}`)`.
 * Don't write `url: '=/artist/{{$parameter.artistId}}'` instead: in By URL
 * mode that expression is the whole pasted URL, not the extracted ID.
 */
export function setUrlFromLocator(parameterName: string, toPath: (id: string) => string) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const id = this.getNodeParameter(parameterName, undefined, { extractValue: true }) as string;
		requestOptions.url = toPath(encodeURIComponent(String(id).trim()));
		return requestOptions;
	};
}

export interface ListSearchOptions {
	/** The credential type name, as in the node's `credentials` array. */
	credentialType: string;
	/** Absolute URL of the search endpoint (requestDefaults don't apply here). */
	url: string;
	/** Query parameters for one search, e.g. (filter) => ({ query: filter }). */
	searchQs: (filter: string) => IDataObject;
	/** Response key holding the array of records. */
	listKey: string;
	/** One picker entry per record: name shown, value stored, optional url. */
	toItem: (record: IDataObject) => INodeListSearchItems;
	/** Records per picker page. 0 turns paging off. */
	pageSize?: number;
	/** `offset` (default): limit + record offset. `page`: page size + page number. */
	paging?: 'offset' | 'page';
	/** Page-size query parameter. Default 'limit'. */
	limitParameter?: string;
	/** Offset query parameter (offset paging). Default 'offset'. */
	offsetParameter?: string;
	/** Page-number query parameter (page paging). Default 'page'. */
	pageParameter?: string;
	/** Number of the first page (page paging). Default 1. */
	firstPage?: number;
	headers?: IDataObject;
}

/**
 * A `methods.listSearch` function. n8n calls it with `filter` undefined as
 * soon as the picker opens, so an empty filter returns no results without a
 * request: most search APIs reject an empty query. Pages with limit/offset or
 * page numbers; the pagination token is the next offset or page number.
 */
export function createListSearch(options: ListSearchOptions) {
	const pageSize = options.pageSize ?? 25;
	const byPage = options.paging === 'page';
	const limitParameter = options.limitParameter ?? 'limit';
	const offsetParameter = options.offsetParameter ?? 'offset';
	const pageParameter = options.pageParameter ?? 'page';
	const firstPage = options.firstPage ?? 1;
	return async function (
		this: ILoadOptionsFunctions,
		filter?: string,
		paginationToken?: string,
	): Promise<INodeListSearchResult> {
		const text = filter?.trim();
		if (!text) {
			return { results: [] };
		}
		const position = paginationToken ? Number(paginationToken) : byPage ? firstPage : 0;
		const qs: IDataObject = { ...options.searchQs(text) };
		if (pageSize > 0) {
			qs[limitParameter] = pageSize;
			qs[byPage ? pageParameter : offsetParameter] = position;
		}
		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			options.credentialType,
			{ method: 'GET', url: options.url, qs, headers: options.headers, json: true },
		)) as IDataObject;
		const records = (response[options.listKey] as IDataObject[] | undefined) ?? [];
		const full = pageSize > 0 && records.length === pageSize;
		const next = byPage ? position + 1 : position + pageSize;
		return {
			results: records.map(options.toItem),
			paginationToken: full ? String(next) : undefined,
		};
	};
}
