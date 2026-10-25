import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import {
	camel,
	ENTITIES,
	includeResponseKeys,
	LINKED_NAMES,
	pascal,
	RELATIONSHIP_TYPES,
	RELEASE_GROUP_TYPES,
	RELEASE_STATUSES,
	titleCase,
	type EntityConfig,
} from './entities';
import { buildOutputProperties, outputList, outputSingle } from './output';
import { buildReturnAllProperties, paginateWithDelay } from './pagination';
import { setBrowseQs, setIncludeQs } from './query';
import { buildResourceLocator, setUrlFromLocator } from './resourceLocator';

export const MBID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
// MusicBrainz allows about one request per second: pause a little longer.
const PAGE_DELAY_MS = 1100;

type Show = { resource: string[]; operation: string[] };
const show = (entity: EntityConfig, operation: string): Show => ({
	resource: [entity.value],
	operation: [operation],
});

const lower = (entity: EntityConfig) => entity.name.toLowerCase();
const article = (entity: EntityConfig) => (/^[aeiou]/i.test(entity.name) ? 'an' : 'a');

const MISC_INCLUDES = ['aliases', 'annotation', 'genres', 'tags'];

/** Include options for one entity: misc, its own subqueries, relationships. */
export function includeOptions(entity: EntityConfig): INodePropertyOptions[] {
	const values = [
		...MISC_INCLUDES,
		...(entity.ratings ? ['ratings'] : []),
		...entity.includes,
		...RELATIONSHIP_TYPES.map((type) => `${type}-rels`),
	];
	return [...new Set(values)]
		.map((value) => ({
			name: value.endsWith('-rels')
				? `${titleCase(value.slice(0, -5))} Relationships`
				: titleCase(value),
			value,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Selectable fields for Output = Selected Fields. */
export function fieldOptions(entity: EntityConfig): INodePropertyOptions[] {
	const keys = new Set([
		...entity.simplified,
		...entity.extraFields,
		'aliases',
		'annotation',
		'genres',
		'tags',
		'relations',
		...(entity.ratings ? ['rating'] : []),
	]);
	keys.delete('id');
	return [...keys]
		.map((key) => ({ name: key === 'score' ? 'Search Score' : titleCase(key), value: key }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

function operationProperty(entity: EntityConfig): INodeProperties {
	const plural = entity.listKey.replace(/-/g, ' ');
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [entity.value] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: `Get ${article(entity)} ${lower(entity)}`,
				description: `Get one ${lower(entity)} by MusicBrainz ID`,
				routing: {
					request: { method: 'GET' },
					send: {
						preSend: [setUrlFromLocator(`${camel(entity.value)}Id`, (id) => `/${entity.value}/${id}`), setIncludeQs],
					},
					output: {
						postReceive: [
							outputSingle(entity.simplified, {
								parameter: 'options.include',
								responseKeys: includeResponseKeys(entity.value),
							}),
						],
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: `Get many ${plural}`,
				description: `Get the ${plural} linked to another entity (MusicBrainz browse)`,
				routing: {
					request: { method: 'GET', url: `/${entity.value}` },
					send: { preSend: [setBrowseQs] },
					// Release browse can return a short page mid-list (500-track cap).
					operations: {
						pagination: paginateWithDelay(100, PAGE_DELAY_MS, {
							untilEmpty: entity.value === 'release',
						}),
					},
					output: { postReceive: [outputList(entity.listKey, entity.simplified)] },
				},
			},
			{
				name: 'Search',
				value: 'search',
				action: `Search ${plural}`,
				description: `Search ${plural} with a name or a MusicBrainz search query`,
				routing: {
					request: { method: 'GET', url: `/${entity.value}` },
					operations: { pagination: paginateWithDelay(100, PAGE_DELAY_MS) },
					output: { postReceive: [outputList(entity.listKey, entity.simplified)] },
				},
			},
		],
		default: 'get',
	};
}

function getProperties(entity: EntityConfig): INodeProperties[] {
	const s = show(entity, 'get');
	return [
		buildResourceLocator({
			name: `${camel(entity.value)}Id`,
			displayName: entity.name,
			description: `The ${lower(entity)} to get`,
			show: s,
			searchListMethod: `search${pascal(entity.value)}`,
			idRegex: MBID,
			idPlaceholder: `e.g. ${entity.exampleId}`,
			idErrorMessage: `Enter a MusicBrainz ${lower(entity)} ID (a UUID)`,
			urlRegex: `https?://(?:www\\.|beta\\.)?musicbrainz\\.org/${entity.value}/(${MBID})`,
			urlPlaceholder: `e.g. https://musicbrainz.org/${entity.value}/${entity.exampleId}`,
			urlErrorMessage: `Enter a musicbrainz.org ${lower(entity)} URL`,
		}),
		{
			displayName: 'Options',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions: { show: s },
			options: [
				{
					displayName: 'Include',
					name: 'include',
					type: 'multiOptions',
					default: [],
					description: 'Extra data to add. Linked lists (e.g. releases) stop at 25; use Get Many for more.',
					options: includeOptions(entity),
				},
			],
		},
		...buildOutputProperties(s, fieldOptions(entity)),
	];
}

function getManyProperties(entity: EntityConfig): INodeProperties[] {
	const s = show(entity, 'getAll');
	const properties: INodeProperties[] = [
		{
			displayName: 'Linked To',
			name: 'linkedTo',
			type: 'options',
			required: true,
			default: entity.linkedTo[0],
			description: `The kind of entity the ${entity.listKey.replace(/-/g, ' ')} are linked to`,
			displayOptions: { show: s },
			options: entity.linkedTo.map((value) => ({ name: LINKED_NAMES[value] ?? titleCase(value), value })),
		},
		{
			displayName: 'Linked Entity ID',
			name: 'linkedId',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'e.g. 5b11f4ce-a62d-471e-81fc-a69a8278c7da',
			description: 'MusicBrainz ID of the linked entity',
			displayOptions: { show: s },
		},
	];
	if (entity.browseFilters.length > 0) {
		properties.push({
			displayName: 'Filters',
			name: 'browseFilters',
			type: 'collection',
			placeholder: 'Add Filter',
			default: {},
			displayOptions: { show: s },
			options: [
				{
					displayName: 'Release Group Type',
					name: 'type',
					type: 'multiOptions',
					default: [],
					options: RELEASE_GROUP_TYPES.map((value) => ({ name: titleCase(value.replace(/ /g, '-')), value })),
				},
				...(entity.browseFilters.includes('status')
					? [
							{
								displayName: 'Release Status',
								name: 'status',
								type: 'multiOptions' as const,
								default: [],
								options: RELEASE_STATUSES.map((value) => ({ name: titleCase(value), value })),
							},
						]
					: []),
			],
		});
	}
	return [...properties, ...buildReturnAllProperties(s), ...buildOutputProperties(s, fieldOptions(entity))];
}

function searchProperties(entity: EntityConfig): INodeProperties[] {
	const s = show(entity, 'search');
	return [
		{
			displayName: 'Query',
			name: 'query',
			type: 'string',
			required: true,
			default: '',
			placeholder: `e.g. ${entity.searchExample}`,
			description: `A ${lower(entity)} name, or a query in MusicBrainz search syntax (Lucene)`,
			displayOptions: { show: s },
			routing: { request: { qs: { query: '={{$value}}' } } },
		},
		...buildReturnAllProperties(s),
		...buildOutputProperties(s, fieldOptions(entity)),
	];
}

/** All resource-specific properties, entity by entity. */
export const entityProperties: INodeProperties[] = ENTITIES.flatMap((entity) => [
	operationProperty(entity),
	{
		displayName:
			'MusicBrainz allows about one request per second. For many input items, add the Batching request option with Items per Batch 1 and Batch Interval (ms) 1000.',
		name: 'rateLimitNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: [entity.value] } },
	},
	...getProperties(entity),
	...getManyProperties(entity),
	...searchProperties(entity),
]);
