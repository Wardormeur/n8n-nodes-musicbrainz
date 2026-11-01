# Reference: "Return All" / "Limit" and declarative pagination

Sources (docs.n8n.io has **no** pagination guidance for node authors.
Checked 2026-10-17: `ux-guidelines.md` and `plan-your-node/node-ui-design.md`
never mention "Return All", "returnAll" or pagination):
- `n8n-workflow` 2.16.0 types: `INodePropertyRouting.operations`,
  `IN8nRequestOperations.pagination`, `IN8nRequestOperationPaginationOffset` /
  `...Generic`, `IExecutePaginationFunctions.makeRoutingRequest`,
  `DeclarativeRestApiSettings.ResultOptions`.
- `n8n-core/dist/execution-engine/routing-node.js` (n8n 2.37.10, compiled):
  how `paginate`, `operations.pagination` and `output.maxResults` run.
- n8n's own built-in nodes (`n8n-nodes-base` 2.37.10): 550 files declare
  a `returnAll` parameter. The declarative precedent below is
  `nodes/Brevo/ContactDescription.js`.
- Live-tested 2026-10-17 on the MusicBrainz node, through the real engine
  with the HTTP counter from `templates/test/e2e/`.

## The UX convention: Return All + Limit
Every n8n list operation ("Get Many", search) offers:
- **Return All** (`returnAll`, boolean, default `false`), described exactly
  as "Whether to return all results or only up to a given limit".
- **Limit** (`limit`, number, default `50`, `minValue: 1`), shown only when
  `returnAll` is false (`displayOptions.show.returnAll: [false]`), described
  as "Max number of results to return".

Don't expose a raw Offset/Page parameter alongside them. Return All replaces
manual paging.

## How the engine paginates a declarative node
Two pieces must both be present:
1. A property whose routing sets **`send.paginate`**, normally Return All:
   `routing: { send: { paginate: '={{$value}}' } }`.
2. The operation's **`routing.operations.pagination`**.

When `paginate` is false, the operation makes one request. Limit's own
routing then applies: `request.qs.limit` (or `send: { type: 'query',
property: 'limit' }` as in Brevo) and, optionally, `output.maxResults:
'={{$value}}'`, which trims the returned items to that many. When Return All
is on, Limit is hidden and **its routing is not applied**. Verified: a Return
All run returned all 104 results, not the default 50.

`operations.pagination` has three forms:
- **`{ type: 'offset', properties: { limitParameter, offsetParameter, pageSize, type: 'query' | 'body', rootProperty? } }`.**
  The engine sets `limit = pageSize` and `offset = 0`, adds `pageSize` to
  the offset after each page, and stops when a page has fewer than
  `pageSize` items. "Items" means after the operation's `postReceive`; with
  `rootProperty`, it's the array at that path of the raw response. Brevo
  uses this with `pageSize: 1000`.
- **`{ type: 'generic', properties: { continue, request } }`.** For cursor or
  next-link APIs. `request` (merged into each request) and `continue` (a
  boolean expression) are expressions with `$response` and `$request`
  available. Not tested here.
- **A function** `(this: IExecutePaginationFunctions, requestData) => Promise<INodeExecutionData[]>`.
  You write the loop yourself and call `this.makeRoutingRequest(requestData)`
  per page. Each call runs the operation's preSend, request and
  `postReceive` hooks and returns the items for that page.

## Rate-limited APIs: the built-in modes don't pause between pages
The `offset` and `generic` loops send page requests **back to back**. The
batching setting ([22-reference-batching.md](22-reference-batching.md))
only spaces out *input items*, not pages within one item. Return All over
a large result set will therefore burst into the API's rate limit
(MusicBrainz: about 1 request/s, answered with 503).

For a rate-limited API, use the **function form with a pause**:
`templates/nodes/__NodeName__/actions/pagination.ts` provides
`buildReturnAllProperties(show)` and `paginateWithDelay(pageSize, delayMs)`.
Live result (MusicBrainz Search, 104 results, page size 100, 1000 ms delay):
2 requests (`offset=0`, `offset=100`) 1180 ms apart, 104 items. Return All
off with Limit 30: 1 request with `limit=30`, 30 items.

**Page-number APIs** (a page size plus a page number, e.g. Discogs
`per_page` + `page`, starting at 1): pass
`{ style: 'page', limitParameter: 'per_page' }` to both
`buildReturnAllProperties` and `paginateWithDelay` (`pageParameter` and
`firstPage` default to `page` and 1). Live result (Discogs Release Search,
190 results, page size 100, 1100 ms delay, 2026-10-20): 2 requests
(`page=1`, `page=2`) 1569 ms apart, 190 items. The stop condition is the
same short page.

**APIs that return short pages mid-list:** the short-page stop is wrong when
the API can return fewer records than asked for before the end. MusicBrainz
release browse caps a page at 500 tracks, and its docs say to "increase
`offset` by the number of releases actually returned, not by `limit`". Pass
`{ untilEmpty: true }` (offset style): the offset advances by the records
returned and the loop stops only on an empty page, at the cost of one extra
request. Live (MusicBrainz releases of a release group, status official,
2026-10-25): `offset=0` returned 95, then `offset=95` returned 0, 95 items.
Check the target API's docs for such a rule when it has paged lists.

Behaviors of the template's function (unit-tested, 5 tests):
- It stops on a short page, so a total that's an exact multiple of the
  page size costs one extra, empty request. The built-in `offset` mode
  behaves the same way.
- It keeps the other query params (`query`, `fmt`, etc.) and only sets
  `limit`/`offset`.
- It pauses between pages, not after the last one.
- The page size is the API's maximum per request, which keeps the number of
  requests down. Check the API's documented cap (MusicBrainz: 100).

## Stability caveat
Type shapes come from the published `n8n-workflow` package. The loop
behavior (stop condition, Limit not applied under Return All, no pause
between pages) comes from compiled `n8n-core` 2.37.10 plus live tests, not
from docs. Re-check on this skill's next source-verification pass.
