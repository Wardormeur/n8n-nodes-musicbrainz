import type { IDataObject, IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';

// Characters with a meaning in MusicBrainz's Lucene query syntax.
const LUCENE_SPECIAL = /[+\-&|!(){}[\]^"~*?:\\/]/g;

/** Escapes text so MusicBrainz's Lucene search treats it as plain words. */
export function escapeLucene(text: string): string {
	return text.replace(LUCENE_SPECIAL, (char) => `\\${char}`);
}

/**
 * preSend for Get Many: MusicBrainz browses by a query key named after the
 * linked entity type (`?release=<mbid>`), which static routing can't name.
 * Adds the release type / status filters, `|`-separated, when set.
 */
export async function setBrowseQs(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const linkedTo = this.getNodeParameter('linkedTo', 'artist') as string;
	const linkedId = String(this.getNodeParameter('linkedId', '')).trim();
	const filters = this.getNodeParameter('browseFilters', {}) as IDataObject;
	const qs: IDataObject = { ...requestOptions.qs, [linkedTo]: linkedId };
	for (const key of ['type', 'status']) {
		const values = (filters[key] as string[] | undefined) ?? [];
		if (values.length > 0) qs[key] = values.join('|');
	}
	requestOptions.qs = qs;
	return requestOptions;
}

/** preSend for Get: adds `inc` only when something is selected. */
export async function setIncludeQs(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const include = this.getNodeParameter('options.include', []) as string[];
	if (include.length > 0) {
		// Space-separated: the query encoder turns a literal '+' into %2B.
		requestOptions.qs = { ...requestOptions.qs, inc: include.join(' ') };
	}
	return requestOptions;
}
