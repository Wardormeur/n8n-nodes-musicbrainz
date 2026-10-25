import type { IDataObject, INodeListSearchItems } from 'n8n-workflow';

import { ENTITIES, pascal, type EntityConfig } from '../actions/entities';
import { escapeLucene } from '../actions/query';
import { createListSearch } from '../actions/resourceLocator';

export const API_URL = 'https://musicbrainz.org/ws/2';

/** One picker entry: name or title, plus disambiguation (and date for releases). */
export function toItem(entity: EntityConfig, record: IDataObject): INodeListSearchItems {
	const label = String(record[entity.titleKey] ?? record.id);
	const details = [record.disambiguation, entity.value === 'release' ? record.date : undefined]
		.filter(Boolean)
		.join(', ');
	return {
		name: details ? `${label} (${details})` : label,
		value: String(record.id),
		url: `https://musicbrainz.org/${entity.value}/${String(record.id)}`,
	};
}

// The picker searches the typed text literally (escaped), not as Lucene. It
// runs outside routing, so requestDefaults don't apply: absolute URL and
// Accept header here; the credential adds the User-Agent.
export const listSearchMethods = Object.fromEntries(
	ENTITIES.map((entity) => [
		`search${pascal(entity.value)}`,
		createListSearch({
			credentialType: 'musicBrainzApi',
			url: `${API_URL}/${entity.value}`,
			headers: { Accept: 'application/json' },
			searchQs: (filter) => ({ query: escapeLucene(filter) }),
			listKey: entity.listKey,
			toItem: (record) => toItem(entity, record),
		}),
	]),
);
