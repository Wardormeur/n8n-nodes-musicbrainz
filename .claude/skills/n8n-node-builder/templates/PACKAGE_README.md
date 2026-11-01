# n8n-nodes-__service__

__One sentence: what this community node does__

## Installation

Follow n8n's [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and install `n8n-nodes-__service__`.

## Credentials

<!-- How to get the credential: account, API key or token location, scopes,
or why no secret is needed. Link the service's auth docs. Delete this comment. -->
__Credentials section__

## Operations

<!-- One bullet per resource and operation, with what each returns. Mention
Return All / Limit and the Output setting if the node has them. Delete this comment. -->
__Operations section__

## Rate limit

<!-- The service's limit and the status code it answers with. Then, as they
apply: Return All pauses between pages (paginateWithDelay); many input items
need the node's Batching request option, with Items per Batch / Batch
Interval values for this API (a node can't turn batching on by default,
references/22-reference-batching.md); Retry On Fail retries every error, 4xx
included. Delete this section only if the API has no rate limit. Delete this
comment. -->
__Rate limit section__

## Development

```
npm install
npm run build      # compile and copy icons/codex into dist/
npm run lint
npm test           # unit tests
npm run test:e2e   # needs a local n8n with this package linked and a __NodeName__ credential
npm run test:fixtures   # the workflows in test/fixtures, which check themselves (stop n8n start first)
```

`test:e2e` runs the node through n8n's engine and checks the number of real
HTTP calls with Retry On Fail off (1) and on with 3 tries (3).

### Releasing

`npm version patch` (or `minor`/`major`), then `git push --follow-tags`. The
tag starts `.github/workflows/publish.yml`, which lints, builds, tests and
publishes to npm with a provenance statement.

## License

MIT
