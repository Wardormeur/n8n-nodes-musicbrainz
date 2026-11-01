# Reference: node UI elements (parameter types)

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/node-ui-elements.md

All elements support `displayOptions.show` (conditional visibility based on
other params, e.g. resource/operation), `description`, `default`, and
`typeOptions` for type-specific tweaks.

## Simple types
- **string** — text input. `typeOptions: { password: true }` masks it;
  `typeOptions: { rows: 4 }` makes it a textarea. `requiresDataPath: 'single'|'multiple'`
  enables drag-and-drop of an upstream field path into the value.
- **number** — `typeOptions: { minValue, maxValue, numberPrecision }`.
- **boolean** — toggle switch, set via `default`.
- **color** — color picker (hex/RGB).
- **dateTime** — date/time picker.
- **options** — single-select dropdown; each option is `{ name, value }`.
- **multiOptions** — multi-select shown as removable tags; default `[]`.

## Collections
- **collection** — groups optional fields behind an "Add Field" `placeholder`
  button; `options` is the array of fields inside.
- **fixedCollection** — groups semantically related fields together;
  `typeOptions: { multipleValues: true }` makes it repeatable; nested shape is
  `options: [{ name, displayName, values: [ ...fields ] }]`.
- **assignmentCollection** — drag-and-drop name/value pair builder; needs no
  extra config beyond `type: 'assignmentCollection'`.

## Service-integration types
- **resourceLocator** — multi-mode field (by ID / by URL / from a searchable
  list). Each mode defines its own validation, placeholder, and value
  extraction. "List" mode needs a `searchListMethod` (implemented under
  `methods.listSearch`) to populate/search options. Use this for "pick a
  record" style fields instead of a free-text ID.
  - **The `listSearch` method is called with `filter: undefined` the instant
    the picker opens, before the user types anything** — confirmed live
    (MusicBrainz node, 2026-09-08), not just when the search box is
    explicitly cleared. If the method passes that straight through to build
    a request to a target API that itself requires a non-empty query (many
    search endpoints do, and hard-reject an empty one rather than treating
    it as "list everything"), the picker fails on open, before a single
    character can be typed. Guard for empty/undefined `filter` and return
    `{ results: [] }` (or a static/cached default list, if the target API
    has one) instead of calling the API with a request known to fail. See
    [12-test-your-node.md](12-test-your-node.md#when-to-add-unit-tests-beyond-these-two-methods)
    for how to unit-test this guard without a live n8n instance, and
    [13-run-locally.md](13-run-locally.md#an-easy-to-skip-manual-test-opening-a-from-list-picker-before-typing)
    for the manual-testing angle.
  - **Don't use a resourceLocator in a routing expression. Build the URL in
    a preSend.** In `{{ }}` routing expressions, `$parameter.<name>` is the
    mode's raw `value` string, never the stored `{ __rl, mode, value }`
    object. So `.value` gives `undefined`, which a `url` template renders as
    an empty string: a request to `/artist/` and a misleading 400
    (MusicBrainz node, 2026-09-06). The raw value is the ID in From List and
    By ID mode, but in By URL mode it's **the whole pasted URL**, because the
    mode's `extractValue` regex is not applied (cold-build test, 2026-10-17:
    the request went to `/artist/https://musicbrainz.org/artist/<id>`, 400).
    `extractValue` only runs inside
    `this.getNodeParameter(name, undefined, { extractValue: true })`
    (n8n-core 2.37.10 `node-execution-context.js` and
    `utils/extract-value.js`; live-tested in a preSend on 2026-10-17). For
    modes without `extractValue` it returns the plain `value`. The regex
    must have **exactly one capture group**, or n8n throws "extractValue
    expects exactly one group".
  - **Template:** `templates/nodes/__NodeName__/actions/resourceLocator.ts`
    (`scaffold.mjs --resource-locator`, 21 tests):
    - `buildResourceLocator({...})` gives the parameter with From List /
      By ID / By URL modes, validation regexes and `extractValue`.
    - `setUrlFromLocator(name, toPath)` is the operation's preSend, e.g.
      `send: { preSend: [setUrlFromLocator('artistId', (id) => '/artist/' + id)] }`.
    - `createListSearch({...})` builds the `methods.listSearch` function
      with the empty-filter guard and paging through the
      `paginationToken`: limit/offset by default, or page numbers with
      `paging: 'page'` (plus `limitParameter`, e.g. `per_page`). Live with
      Discogs, 2026-10-20: token `2` fetched page 2. Register it as
      `methods = { listSearch: { searchThings: createListSearch({...}) } }`
      and name it in `searchListMethod`. It runs outside routing, so
      `requestDefaults` (base URL, headers) don't apply: give it an
      absolute URL and any headers the API needs.
  - **n8n anchors validation regexes; it doesn't anchor `extractValue`.**
    A mode's `validation` regex is tested as `^<regex>$` against the whole
    value (`n8n-workflow` 2.37.4 `node-helpers.js`,
    `validateResourceLocatorParameter`). The `extractValue` regex runs
    unanchored. So one regex can't serve both: a URL regex that stops at the
    ID extracts fine, but it rejects any pasted URL with something after the
    ID (`/relationships`, `?tab=1`, a trailing `/`). The node fails before
    running, with "The '<node>' node has issues". Cold-build test,
    2026-10-20. The template takes `urlRegex` (the service-specific part, up
    to and including the ID) and appends `urlTail` for validation only. The
    default tail `(?:[/?#&].*)?` allows any path, query or fragment after
    the ID. Pass a stricter `urlTail` if an ID can run on into the following
    characters. Don't put `^`/`$` in `idRegex` or `urlRegex`. A value that
    starts with `=` (an expression) skips validation entirely.
  - **Escape the picker's search text for the API's query syntax.** The
    `filter` is whatever the user types. For a search API with a query
    language (Lucene, as in MusicBrainz, Elasticsearch, Solr), characters
    like `/`, `(`, `)`, `:` and `"` change the query or break it, so escape
    them in `createListSearch`'s `searchQs`. A Search operation that
    exposes the query language on purpose can pass it through raw.
- **resourceMapper** — maps input item fields onto the target service's
  schema for insert/update/upsert. Needs `resourceMapperMethod` (a
  `methods.resourceMapping` function that returns the schema),
  `mode: 'add'|'update'|'upsert'`, optional `multiKeyMatch` for
  multi-column matching, `supportAutoMap` to auto-map same-named fields.
  Schema entries are `ResourceMapperField { id, displayName, required,
  display, type, options }`.
- **filter** — lets users build conditions over incoming data; configurable
  case sensitivity and type-strictness via its collection options.

## Data-format types
- **json** — syntax-highlighted JSON editor, supports expressions.
- **html** — template editor with HTML/CSS + `{{}}` expressions; embedded
  JS is not executed.

## Informational types
- **notice** — yellow info box; only needs `displayName`, `name`,
  `type: 'notice'` (no `default`/value).
- **hints** — parameter hints (small text below a field) or node hints
  (shown in input/output/details panels, can be conditional via
  `displayCondition` and timed via `beforeExecution`/`afterExecution`/`always`).

See [04-node-ui-design.md](04-node-ui-design.md) for when/how to use each of
these (ordering, disclosure, naming conventions).
