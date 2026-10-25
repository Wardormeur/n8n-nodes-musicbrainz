import { NodeConnectionTypes } from 'n8n-workflow';
import type { INodeType, INodeTypeDescription } from 'n8n-workflow';

import { ENTITIES } from './actions/entities';
import { entityProperties } from './actions/operations';
import { API_URL, listSearchMethods } from './methods/listSearch';

export class MusicBrainz implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MusicBrainz',
		name: 'musicBrainz',
		icon: { light: 'file:musicbrainz.svg', dark: 'file:musicbrainz.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Look up, search and browse music metadata in the MusicBrainz database',
		defaults: { name: 'MusicBrainz' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'musicBrainzApi', required: true }],
		requestDefaults: {
			baseURL: API_URL,
			headers: { Accept: 'application/json' },
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: ENTITIES.map((entity) => ({ name: entity.name, value: entity.value })),
				default: 'artist',
			},
			...entityProperties,
		],
	};

	methods = {
		listSearch: listSearchMethods,
	};
}
