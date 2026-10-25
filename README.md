# n8n-nodes-musicbrainz

n8n community node for the MusicBrainz API: get, search and browse artists, releases, recordings, labels, works and the other MusicBrainz entities.

The node is read-only and can be used as a tool by n8n's AI Agent.

## Installation

Follow n8n's [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and install `n8n-nodes-musicbrainz`.

## Credentials

MusicBrainz needs no account or API key for reading. It does require every
client to send a meaningful `User-Agent` header and blocks clients that
don't ([MusicBrainz rate limiting and User-Agent rules](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)).

Create a **MusicBrainz API** credential and fill in **User-Agent** with your
application name, version and a contact URL or email address, for example
`MyN8nWorkflows/1.0 ( https://example.com/contact )`. The credential test
looks up one artist.

## Operations

Eleven resources: **Area, Artist, Event, Instrument, Label, Place,
Recording, Release, Release Group, Series** and **Work**. Each has the same
three operations, matching the three kinds of
[MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) request:

- **Get** (lookup): one record by MusicBrainz ID. Pick it from a searchable
  list, enter its ID, or paste its musicbrainz.org URL (sub-pages such as
  `/relationships` and query strings are accepted). **Options > Include**
  adds extra data:
  - for every resource: aliases, annotation, genres, tags, and any kind of
    relationship (artist, label, recording, URL, work...);
  - ratings, for artists, events, labels, places, recordings, release
    groups and works;
  - the resource's own lists: an artist's recordings, releases, release
    groups and works; a label's releases; a recording's releases and ISRCs;
    a release's labels, recordings (tracklist), media and disc IDs; a release
    group's releases. These lists stop at 25 entries; use Get Many for more.
- **Search**: records matching a name or a query in
  [MusicBrainz search syntax](https://musicbrainz.org/doc/MusicBrainz_API/Search),
  e.g. `release:Nevermind AND artist:Nirvana`. Each result has a `score`.
- **Get Many** (browse): the records linked to another entity, given that
  entity's MusicBrainz ID, following MusicBrainz's
  [linked entities](https://musicbrainz.org/doc/MusicBrainz_API#Linked_entities)
  table: for example the releases of an artist, label or release group, the
  recordings of a release or work, the events at a place. Releases and
  release groups can be filtered by type (album, single, EP, live...) and
  releases by status (official, bootleg...).

Search and Get Many have **Return All** and **Limit** (up to 100).

Every operation has an **Output** setting: **Simplified** (the most useful
fields of that resource, plus any data selected under Include), **Raw** (the
full response) or **Selected Fields** (the fields you pick, always with the
ID). Search and Get Many return one item per record.

Not covered: genres and URLs as resources, lookups by ISRC, ISWC or disc
ID, cover art, and anything that writes to MusicBrainz.

## Rate limit

MusicBrainz allows about one request per second per client and answers
faster traffic with HTTP **503**.

- **Return All** fetches 100 results per request and waits 1.1 s between
  pages.
- **Many input items**: n8n sends one request per item, back to back. Open the
  node's **Request Options**, add **Batching**, and set **Items per Batch** to
  `1` and **Batch Interval (ms)** to `1000`. The node can't turn this on by
  default.
- **Retry On Fail** (node settings) helps with occasional 503s; use a
  **Wait Between Tries** of at least 1000 ms. n8n retries every error,
  including a 404 for an unknown ID, which can't succeed on a retry.

## Icon

The icon is the MusicBrainz logo, taken from
[Simple Icons](https://simpleicons.org) 16.35.0 (brand colour `#BA478F`,
source <https://metabrainz.org/projects>). The MusicBrainz name and logo
belong to the MetaBrainz Foundation; this personal, non-commercial package
uses them only to identify the service.

## Design notes

- **Read-only on purpose.** Lookup, search and browse only; no tags,
  ratings, collections or private user data. So there is a single
  credential, the User-Agent, and no OAuth2.
- If write operations are ever wanted, they belong in a separate node with
  its own OAuth2 credential. Putting both credentials on this node brings
  back n8n's multi-credential editor problems: a required `authentication`
  parameter, a duplicate credential row, and a field users can't edit.

## Development

```
npm install
npm run build      # compile and copy icons/codex into dist/
npm run lint
npm test           # unit tests
npm run test:e2e   # needs a local n8n with this package linked and a MusicBrainz credential
npm run test:fixtures   # the workflows in test/fixtures, which check themselves (stop n8n start first)
```

`test:e2e` runs the node through n8n's engine and checks the number of real
HTTP calls with Retry On Fail off (1) and on with 3 tries (3).

## License

MIT
