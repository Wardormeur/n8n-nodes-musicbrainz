# Reference: preSend/postReceive routing hooks (declarative style)

Sources (source-code-confirmed — **not** present in docs.n8n.io's public
node-authoring reference; see the stability caveat at the end):
- `packages/workflow/src/interfaces.ts` (n8n-io/n8n) — `PreSendAction`,
  `PostReceiveAction`, `INodeRequestSend`, `INodeRequestOutput` types.
- `packages/core/src/execution-engine/routing-node.ts` — `RoutingNode`, the
  engine class that executes **all** declarative routing, confirmed to invoke
  these as real functions, not just read them as static config.

Snapshot verified against: `n8n-io/n8n` commit `33eb5c196e0ce3a2c71525929a4ef861cb94b168`.

If a `preSend`/`postReceive` function does more than trivial field mapping —
building a non-JSON request body, custom escaping, response reshaping — see
[12-test-your-node.md](12-test-your-node.md#when-to-add-unit-tests-beyond-these-two-methods)
for when to unit test it directly, since neither manual run nor the linter
will catch a logic bug inside one of these functions.

## What they are
`routing.send.preSend` and `routing.output.postReceive` are **not** limited to
the `methods.loadOptions` static-config examples shown in the tutorials
(`rootProperty`, `sort`, `setKeyValue`). They are general fields on
`INodePropertyRouting` — usable on **any** resource/operation property — and
each can be an array containing either static config *or* an arbitrary async
function:

```ts
type PreSendAction = (
  this: IExecuteSingleFunctions,
  requestOptions: IHttpRequestOptions,
) => Promise<IHttpRequestOptions>;

type PostReceiveAction =
  | ((this: IExecuteSingleFunctions, items: INodeExecutionData[], response: IN8nHttpFullResponse)
      => Promise<INodeExecutionData[]>)
  | IPostReceiveBinaryData | IPostReceiveFilter | IPostReceiveLimit
  | IPostReceiveRootProperty | IPostReceiveSet | IPostReceiveSetKeyValue | IPostReceiveSort;
```

### `getNodeParameter` inside a hook takes no item index
`IExecuteSingleFunctions` (the `this` of every `preSend`/`postReceive`)
already runs scoped to one item, so its `getNodeParameter` has a different
signature from `IExecuteFunctions`'s (`execute()` in programmatic nodes):
```ts
// IExecuteSingleFunctions (hooks)    — n8n-workflow interfaces.d.ts
getNodeParameter(parameterName: string, fallbackValue?: any, options?: IGetNodeParameterOptions)
// IExecuteFunctions (execute())
getNodeParameter(parameterName: string, itemIndex: number, fallbackValue?: any, options?)
```
Writing the `execute()` form inside a hook, `getNodeParameter('output', 0)`,
**type-checks** but means "fallback value 0", not "item 0". TypeScript only
catches it if there's a third argument that doesn't fit
`IGetNodeParameterOptions`. Use `this.getNodeParameter('output', 'simple')`.
Use `this.getItemIndex()` if the index itself is needed.

### A routing expression that resolves to `undefined` is sent as the text `"undefined"`
A static `routing.request.qs`/`body` value can't *omit* a key. Confirmed live
(MusicBrainz, 2026-09-06): a multiOptions field routed as
`qs: { inc: '={{$value.length ? $value.join("+") : undefined}}' }` sent
`?inc=undefined` when the field was empty, and the API rejected it with a 400.
(Contrast: inside a `{{ }}` *string template* such as a `url`, the same
`undefined` becomes an empty string instead. See the resourceLocator note in
[11-reference-ui-elements.md](11-reference-ui-elements.md).) Any optional
query or body key that should be **absent** when empty belongs in a `preSend`
that sets it only when it has a value:
```ts
async function addIncludeQs(this: IExecuteSingleFunctions, requestOptions: IHttpRequestOptions) {
	const inc = this.getNodeParameter('inc', []) as string[];
	if (inc.length > 0) {
		// n8n URL-encodes the qs value, so '+' is sent as %2B. MusicBrainz accepts
		// %2B and spaces alike (live, 2026-10-17 and 2026-10-20); check your API.
		requestOptions.qs = { ...requestOptions.qs, inc: inc.join('+') };
	}
	return requestOptions;
}
// on the operation option: routing: { send: { preSend: [addIncludeQs] }, ... }
// and NO routing on the 'inc' property itself
```

### Items created in a `postReceive` get `pairedItem` automatically
A `postReceive` that turns one list response into several items (one per
entity) can return plain `{ json }` objects. Confirmed in an end-to-end run
(n8n 2.37.10, 2026-10-11): the engine set `pairedItem` on every output item,
pairing all of a request's items to the input item that triggered it (Search →
2 items, both `{item: 0}`; a following Get over those 2 items → `{item: 0}`
and `{item: 1}`). There's no need to build `pairedItem` by hand in
declarative hooks. That advice
([08f-reference-item-linking.md](08f-reference-item-linking.md)) is for
programmatic `execute()`.

### Seeing the fully resolved request
n8n's UI never shows the final request a declarative node sends. When a
request "looks right" in the parameters but the API rejects it, temporarily
add a `preSend` that logs it, then read n8n's stdout:
```ts
async function debugRequest(this: IExecuteSingleFunctions, o: IHttpRequestOptions) {
	console.log(JSON.stringify(o)); // TEMPORARY — remove before committing
	return o;
}
```
Put it **last** in the `preSend` array so it sees what the other hooks
produced. **Nothing will catch it if you forget to remove it**:
`@n8n/eslint-plugin-community-nodes`'s `no-restricted-globals` doesn't list
`console` (checked in v0.31.0; its list is timers, `process`, `global`/`globalThis`,
`__dirname`/`__filename`), so a leftover log ships silently. Grep for
`console.` before considering the node done. This technique found both the
`.value` bug and the `"undefined"` bug above.

## Execution order (why this matters for body/content-type overrides)
`RoutingNode.makeRequest()` runs every `preSend` function over
`requestOptions` in order, **then** passes that exact object straight to
`httpRequestWithAuthentication`/`httpRequest` — there is no serialization step
in between. A `preSend` function has the final word on `requestOptions.body`
and `.headers`. `IHttpRequestOptions.body` is typed to allow `string`, so
replacing a JSON-shaped body with a hand-built string in any other format
(XML, form-urlencoded, multipart, ...) plus a matching `Content-Type` header
works cleanly — the engine doesn't fight it or re-serialize afterward.

## Real precedent (not theoretical)
- `packages/nodes-base/nodes/Aws/IAM/helpers/utils.ts` —
  `encodeBodyAsFormUrlEncoded`, a `preSend` function that takes the
  declaratively-built body object and re-serializes it entirely as
  `application/x-www-form-urlencoded` right before send. Used via
  `routing.send.preSend: [encodeBodyAsFormUrlEncoded]` on `AwsIam.node.ts`'s
  top-level `resource` property.
- `packages/nodes-base/nodes/Google/CloudStorage/ObjectDescription.ts` — a
  `preSend` function that overwrites `requestOptions.headers['Content-Type']`
  and `.body` for a multipart upload.
- `packages/nodes-base/nodes/Google/Ads/CampaignDescription.ts` —
  `processCampaignSearchResponse`, a `postReceive` function that reshapes a
  real API response (`{results: [...]}`) into flattened node output items, on
  an ordinary "Get Many"-style operation, not `loadOptions`.
- `packages/nodes-base/nodes/PostBin/RequestDescription.ts` — both hooks used
  together on ordinary CRUD-style operations (`preSend` to build a dynamic
  URL, `postReceive` with a static `set` action to reshape the response).
- Further real examples found via `gh search code "preSend" --repo n8n-io/n8n`:
  `Brevo/EmailDescription.ts`, `Npm/DistTagDescription.ts`,
  `Aws/Cognito/AwsCognito.node.ts`, `HighLevel/.../TaskDescription.ts`,
  `Microsoft/SharePoint/.../item/*.operation.ts`,
  `Microsoft/AzureCosmosDb/.../item/*.operation.ts`,
  `Gong/descriptions/CallDescription.ts`, `WhatsApp/MediaDescription.ts`.

## Stability caveat — read before relying on this for a verified node
Confirmed **absent** from docs.n8n.io's public node-authoring reference
(checked `build-your-node/reference/base-files/declarative-style-parameters`
and the declarative tutorial directly — both only show `postReceive` as
static config inside a `loadOptions` example, never document it as a general
function hook available on ordinary operations).

However: an n8n staff member ("marcus") confirmed this exact pattern on the
community forum
(https://community.n8n.io/t/how-to-write-my-own-version-of-rootproperty-postreceive-functoin/23305,
2023-02-27) as "the alternative for custom node development," explicitly
linking the Google Ads example above as the model to follow.

Treat this as **source-confirmed and staff-endorsed, but not a documented,
guaranteed-stable public contract** — it's real, widely used by first-party
nodes, and safe to build on, but not something docs.n8n.io or the
verification checklist will reference by name. Validate it against a real
n8n install when building, and re-check on this skill's next refresh whether
`declarative-style-parameters.md` has been updated to document it properly
(that would upgrade this from "confirmed via source" to "confirmed via
docs" and remove this caveat).
