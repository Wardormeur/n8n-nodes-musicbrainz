// MusicBrainz core entities, from https://musicbrainz.org/doc/MusicBrainz_API
// ("Linked entities" for browse, "inc=" subqueries for lookups) and from live
// responses (list keys, fields). Genre and URL are left out: genre has no
// search, and both only browse by collection.

export interface EntityConfig {
	/** API name, used in paths and as the resource value, e.g. 'release-group'. */
	value: string;
	/** Display name, e.g. 'Release Group'. */
	name: string;
	/** Key of the list in search and browse responses, e.g. 'release-groups'. */
	listKey: string;
	/** The record's display key: most entities have a name, some a title. */
	titleKey: 'name' | 'title';
	/** Output = Simplified keeps these keys. */
	simplified: string[];
	/** Extra keys selectable in Output = Selected Fields. */
	extraFields: string[];
	/** Browse ("Get Many") linked entity types (the query key). */
	linkedTo: string[];
	/** Entity-specific inc= values (subqueries and modifiers). */
	includes: string[];
	/** Whether MusicBrainz has ratings for it (series rejects inc=ratings). */
	ratings: boolean;
	/** Browse filters MusicBrainz accepts for it. */
	browseFilters: Array<'type' | 'status'>;
	/** Example Lucene query for the Search placeholder. */
	searchExample: string;
	/** Example MBID for placeholders. */
	exampleId: string;
}

export const ENTITIES: EntityConfig[] = [
	{
		value: 'area',
		name: 'Area',
		listKey: 'areas',
		titleKey: 'name',
		simplified: ['id', 'name', 'sort-name', 'type', 'iso-3166-1-codes', 'life-span', 'disambiguation', 'score'],
		extraFields: ['iso-3166-2-codes'],
		linkedTo: ['collection'],
		includes: [],
		ratings: false,
		browseFilters: [],
		searchExample: 'area:Iceland AND type:Country',
		exampleId: '6a264f94-6ff1-30b1-9a81-41f7bfabd616',
	},
	{
		value: 'artist',
		name: 'Artist',
		listKey: 'artists',
		titleKey: 'name',
		simplified: ['id', 'name', 'sort-name', 'type', 'country', 'disambiguation', 'life-span', 'score'],
		extraFields: ['area', 'begin-area', 'end-area', 'gender', 'ipis', 'isnis'],
		linkedTo: ['area', 'collection', 'recording', 'release', 'release-group', 'work'],
		includes: ['recordings', 'releases', 'release-groups', 'works'],
		ratings: true,
		browseFilters: [],
		searchExample: 'artist:nirvana AND country:US',
		exampleId: '5b11f4ce-a62d-471e-81fc-a69a8278c7da',
	},
	{
		value: 'event',
		name: 'Event',
		listKey: 'events',
		titleKey: 'name',
		simplified: ['id', 'name', 'type', 'time', 'life-span', 'cancelled', 'disambiguation', 'score'],
		extraFields: ['setlist'],
		linkedTo: ['area', 'artist', 'collection', 'place'],
		includes: [],
		ratings: true,
		browseFilters: [],
		searchExample: 'event:Glastonbury AND type:Festival',
		exampleId: '27ba6fd7-60af-4c38-8128-27053c8dc130',
	},
	{
		value: 'instrument',
		name: 'Instrument',
		listKey: 'instruments',
		titleKey: 'name',
		simplified: ['id', 'name', 'type', 'description', 'disambiguation', 'score'],
		extraFields: [],
		linkedTo: ['collection'],
		includes: [],
		ratings: false,
		browseFilters: [],
		searchExample: 'instrument:piano',
		exampleId: 'b3eac5f9-7859-4416-ac39-7154e2e8d348',
	},
	{
		value: 'label',
		name: 'Label',
		listKey: 'labels',
		titleKey: 'name',
		simplified: ['id', 'name', 'sort-name', 'type', 'label-code', 'country', 'area', 'life-span', 'disambiguation', 'score'],
		extraFields: ['ipis', 'isnis'],
		linkedTo: ['area', 'collection', 'release'],
		includes: ['releases'],
		ratings: true,
		browseFilters: [],
		searchExample: 'label:"Sub Pop"',
		exampleId: '38dc88de-7720-4100-9d5b-3cdc41b0c474',
	},
	{
		value: 'place',
		name: 'Place',
		listKey: 'places',
		titleKey: 'name',
		simplified: ['id', 'name', 'type', 'address', 'coordinates', 'area', 'life-span', 'disambiguation', 'score'],
		extraFields: [],
		linkedTo: ['area', 'collection'],
		includes: [],
		ratings: true,
		browseFilters: [],
		searchExample: 'place:"Abbey Road Studios"',
		exampleId: 'bea135c0-a32e-49be-85fd-9234c73fa0a8',
	},
	{
		value: 'recording',
		name: 'Recording',
		listKey: 'recordings',
		titleKey: 'title',
		simplified: ['id', 'title', 'length', 'first-release-date', 'artist-credit', 'disambiguation', 'score'],
		extraFields: ['video', 'isrcs', 'releases'],
		linkedTo: ['artist', 'collection', 'release', 'work'],
		includes: ['releases', 'release-groups', 'artist-credits', 'isrcs'],
		ratings: true,
		browseFilters: [],
		searchExample: 'recording:"Smells Like Teen Spirit" AND artist:Nirvana',
		exampleId: 'a71c683a-a4d2-4f03-84e2-63499ae64ed2',
	},
	{
		value: 'release',
		name: 'Release',
		listKey: 'releases',
		titleKey: 'title',
		simplified: ['id', 'title', 'status', 'date', 'country', 'barcode', 'artist-credit', 'release-group', 'label-info', 'track-count', 'disambiguation', 'score'],
		extraFields: ['packaging', 'release-events', 'text-representation', 'cover-art-archive', 'asin', 'quality', 'media'],
		linkedTo: ['area', 'artist', 'collection', 'label', 'recording', 'release-group', 'track', 'track_artist'],
		includes: ['labels', 'recordings', 'release-groups', 'artist-credits', 'media', 'discids', 'isrcs'],
		ratings: false,
		browseFilters: ['type', 'status'],
		searchExample: 'release:Nevermind AND artist:Nirvana',
		exampleId: 'b52a8f31-b5ab-34e9-92f4-f5b7110220f0',
	},
	{
		value: 'release-group',
		name: 'Release Group',
		listKey: 'release-groups',
		titleKey: 'title',
		simplified: ['id', 'title', 'primary-type', 'secondary-types', 'first-release-date', 'artist-credit', 'disambiguation', 'score'],
		extraFields: ['releases'],
		linkedTo: ['artist', 'collection', 'release'],
		includes: ['releases', 'artist-credits'],
		ratings: true,
		browseFilters: ['type'],
		searchExample: 'releasegroup:Nevermind AND primarytype:Album',
		exampleId: '1b022e01-4da6-387b-8658-8678046e4cef',
	},
	{
		value: 'series',
		name: 'Series',
		listKey: 'series',
		titleKey: 'name',
		simplified: ['id', 'name', 'type', 'disambiguation', 'score'],
		extraFields: [],
		linkedTo: ['collection'],
		includes: [],
		ratings: false,
		browseFilters: [],
		searchExample: 'series:"Grammy Award"',
		exampleId: '117dffca-027e-4f60-8063-91896471603d',
	},
	{
		value: 'work',
		name: 'Work',
		listKey: 'works',
		titleKey: 'title',
		simplified: ['id', 'title', 'type', 'language', 'languages', 'iswcs', 'disambiguation', 'score'],
		extraFields: ['attributes'],
		linkedTo: ['artist', 'collection'],
		includes: [],
		ratings: true,
		browseFilters: [],
		searchExample: 'work:"Smells Like Teen Spirit"',
		exampleId: '9840e142-269d-3fa3-9805-041a9235c18a',
	},
];

/** Display names for linked entity types (browse query keys). */
export const LINKED_NAMES: Record<string, string> = {
	area: 'Area',
	artist: 'Artist',
	collection: 'Collection',
	label: 'Label',
	place: 'Place',
	recording: 'Recording',
	release: 'Release',
	'release-group': 'Release Group',
	track: 'Track',
	track_artist: 'Track Artist (Credited on a Track Only)',
	work: 'Work',
};

// Every relationship include (inc=<type>-rels), offered on all entities.
export const RELATIONSHIP_TYPES = [
	'area',
	'artist',
	'event',
	'genre',
	'instrument',
	'label',
	'place',
	'recording',
	'release',
	'release-group',
	'series',
	'url',
	'work',
];

/** Include value -> top-level response key it adds, where they differ. */
export const INCLUDE_RESPONSE_KEYS: Record<string, string> = {
	ratings: 'rating',
	labels: 'label-info',
	recordings: 'recordings',
	media: 'media',
	discids: 'media',
	'artist-credits': 'artist-credit',
	...Object.fromEntries(RELATIONSHIP_TYPES.map((type) => [`${type}-rels`, 'relations'])),
};

// Release lookups put recordings inside media; artist lookups list them flat.
export const includeResponseKeys = (entity: string): Record<string, string> =>
	entity === 'release' ? { ...INCLUDE_RESPONSE_KEYS, recordings: 'media' } : INCLUDE_RESPONSE_KEYS;

// Release group types and release statuses accepted by type= / status=.
export const RELEASE_GROUP_TYPES = [
	'album',
	'single',
	'ep',
	'broadcast',
	'other',
	'audio drama',
	'audiobook',
	'compilation',
	'demo',
	'dj-mix',
	'field recording',
	'interview',
	'live',
	'mixtape/street',
	'remix',
	'soundtrack',
	'spokenword',
];
export const RELEASE_STATUSES = ['official', 'promotion', 'bootleg', 'pseudo-release', 'withdrawn', 'cancelled'];

/** 'release-group' -> 'releaseGroup': parameter-name prefix per entity. */
export const camel = (value: string) => value.replace(/-(\w)/g, (_m, c: string) => c.toUpperCase());
/** 'release-group' -> 'ReleaseGroup': listSearch method suffix per entity. */
export const pascal = (value: string) => camel(value).charAt(0).toUpperCase() + camel(value).slice(1);

/** 'release-group' -> 'Release Group', 'iso-3166-1-codes' -> 'Iso 3166 1 Codes'. */
export const titleCase = (key: string) =>
	key
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
		.replace(/\bIsrcs\b/, 'ISRCs')
		.replace(/\bIswcs\b/, 'ISWCs')
		.replace(/\bIpis\b/, 'IPIs')
		.replace(/\bIsnis\b/, 'ISNIs')
		.replace(/\bIso\b/, 'ISO')
		.replace(/\bAsin\b/, 'ASIN')
		.replace(/\bDiscids\b/, 'Disc IDs')
		.replace(/\bId\b/, 'ID');
