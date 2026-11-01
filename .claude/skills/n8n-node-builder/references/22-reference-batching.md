# Reference: built-in request batching/throttling (declarative style only)

Sources (source-code-confirmed, n8n@2.37.10 compiled `n8n-core`, re-read and
live-tested 2026-10-11):
- `n8n-core/dist/nodes-loader/directory-loader.js`,
  `applyDeclarativeNodeOptionParameters()`: adds the options below to every
  declarative node.
- `n8n-core/dist/nodes-loader/constants.js`,
  `commonDeclarativeNodeOptionParameters`: the options' shape.
- `n8n-core/dist/execution-engine/routing-node.js`, `RoutingNode`: reads the
  options and sleeps between batches.

docs.n8n.io does **not** document any of this for node authors. Checked
2026-10-11: `declarative-style-parameters.md` never mentions batching, and
`integrations/builtin/rate-limits` presents batching only as an HTTP Request
node option.

## Every declarative node gets batching automatically
When n8n loads a node, `applyDeclarativeNodeOptionParameters()` checks it. If
the node has no `execute`, `trigger`, `webhook` or `polling`, and isn't a
sub-node, n8n **appends** a node-settings parameter to its `properties`:

```ts
{
	displayName: 'Request Options', name: 'requestOptions', type: 'collection',
	isNodeSetting: true, placeholder: 'Add Option', default: {},
	options: [
		{ displayName: 'Batching', name: 'batching', type: 'fixedCollection',
		  default: { batch: {} },
		  options: [{ displayName: 'Batching', name: 'batch', values: [
			{ displayName: 'Items per Batch', name: 'batchSize', type: 'number', default: 50,
			  description: 'Input will be split in batches to throttle requests. -1 for disabled. 0 will be treated as 1.' },
			{ displayName: 'Batch Interval (ms)', name: 'batchInterval', type: 'number', default: 1000,
			  description: 'Time (in milliseconds) between each batch of requests. 0 for disabled.' },
		  ] }] },
		{ displayName: 'Ignore SSL Issues (Insecure)', name: 'allowUnauthorizedCerts', ... },
		{ displayName: 'Proxy', name: 'proxy', ... },
		{ displayName: 'Timeout', name: 'timeout', default: 10000, ... },
	],
}
```

So **a declarative node author writes nothing to get batching**: no routing
key, no property, no code. It's there in every declarative node.
`isNodeSetting: true` means it's shown with the node's settings rather than
its main parameters. Where exactly the editor renders it is an editor-display
claim not yet checked in a running editor.

**What the author can't change:** if the node declares its own property named
`requestOptions`, the loader **replaces** it with the common one and only
merges the node's extra `options` into it, sorted by display name. The
common `default: {}` wins. **A node therefore cannot turn batching on by
default.** It's off until the workflow author adds it. For a rate-limited API,
say so in the README and in the operation descriptions, with the values to
use (e.g. Items per Batch `1`, Batch Interval `1000` for one request per
second).

## How the engine applies it
`RoutingNode` reads `getNodeParameter('requestOptions', 0, {}).batching`.
While starting the item requests, it sleeps `batchInterval` ms before each
new batch of `batchSize` items (`batchSize` ≤ 0 is treated as 1). Requests
within a batch run concurrently. Live-tested 2026-10-11 (MusicBrainz node, 2
items): Get took 200 ms without batching and 1592 ms with
`{ batchSize: 1, batchInterval: 1500 }`. In a workflow JSON fixture it's set
as a node parameter:
`"parameters": { ..., "requestOptions": { "batching": { "batch": { "batchSize": 1, "batchInterval": 1500 } } } }`.

`proxy`, `timeout` and `allowUnauthorizedCerts` from the same collection are
also applied to every request.

On an HTTP **429** only, `RoutingNode` replaces the error message with "Try
spacing your requests out using the batching settings under 'Options'". APIs
that signal rate limiting differently (MusicBrainz uses **503**) get no such
hint. Explain the batching settings in the node's own docs instead.

## Critical scope limit
This **only** applies to declarative-style nodes. The loader skips any node
with `execute`/`trigger`/`webhook`/`polling`, and `RoutingNode` never runs a
programmatic node's `execute()`. A programmatic node must hand-roll any
throttling (e.g. `sleep` from `n8n-workflow` between requests inside
`execute()`). This is worth weighing when choosing a building style for a
rate-limited API: declarative gets throttling for free and programmatic does
not, the opposite of what "programmatic gives more control" might suggest.

## Related, separate mechanism: workflow-author-configured retry
Don't confuse this with "Retry On Fail" / "Wait Between Tries". See
[23-reference-node-runtime-settings.md](23-reference-node-runtime-settings.md).
Batching paces *every* outgoing request in advance, whether or not anything
fails. Retry On Fail only reacts *after* a request has failed. They
complement each other. Only batching is declarative-only; Retry On Fail
applies to any node style.

## Stability caveat
Source-confirmed and live-tested, not documented on docs.n8n.io for node
authors. The injection is a loader implementation detail, so a future n8n
version could change the option's name, shape, or the "cannot set a default"
behavior. Re-check on this skill's next source-verification pass.
