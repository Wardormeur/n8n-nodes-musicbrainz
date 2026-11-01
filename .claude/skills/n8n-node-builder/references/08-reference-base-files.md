# Reference: base files (`<Node>.node.ts`)

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/base-files.md

The base file is the core code of the node. Its shape depends on building style.

## Declarative-style skeleton
Routing lives inline in `properties`, via each option's `routing` key — no
`execute()` method:
```ts
import { INodeType, INodeTypeDescription } from 'n8n-workflow';

export class ExampleNode implements INodeType {
	description: INodeTypeDescription = {
		// Basic node details here
		properties: [
			// Resources and operations here
		]
	};
}
```

## Programmatic-style skeleton
Adds an `execute()` method that reads incoming data/parameters and builds the
request itself:
```ts
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';

export class ExampleNode implements INodeType {
	description: INodeTypeDescription = {
		// Basic node details here
		properties: [
			// Resources and operations here
		]
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Process data and return
	}
}
```

## Standard parameters (`INodeTypeDescription`, both styles)

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/base-files/standard-parameters.md

| Field | Purpose |
|---|---|
| `displayName` (required) | the name users see in the n8n GUI |
| `name` (required) | internal name, used to reference the node elsewhere |
| `icon` (required) | `file:<name>.svg` (PNG accepted, 60×60px), or `{ light: 'file:...', dark: 'file:...' }` for theme-specific variants |
| `group` (required) | array from `'trigger'`, `'schedule'`, `'input'`, `'output'`, `'transform'`, or `[]` — affects execution behavior |
| `description` (required) | brief GUI explanation |
| `defaults` (required) | `{ name: '<canvas label>', color: '<hex>' }` |
| `inputs` / `outputs` (required) | `[NodeConnectionTypes.Main]` for a standard single connector |
| `credentials` | `[{ name: '<CredentialClassName>', required: boolean }]` |
| `requestDefaults` | declarative-only, requires `baseURL`, optional `headers`/`url` |
| `properties` (required) | the UI fields array (resource, operation, per-field params) |
| `forceInputNodeExecution` (optional, boolean) | forces every preceding node to execute before this one runs |
| `requiredInputs` (optional, integer or array) | which multi-input branches must supply data |
| `version` | number (single-version) or array (multi-version) — see below, declarative nodes are restricted here |
| `subtitle` | expression shown under the node name, e.g. `={{$parameter["operation"] + ": " + $parameter["resource"]}}` |
| `usableAsTool` | whether the node can be invoked as an AI-agent tool |

## Declarative-style-only parameters

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/base-files/declarative-style-parameters.md

- **`routing`** (required, per-operation) — the request config (method, url,
  qs, body, `output` post-processing). This is what replaces `execute()`.
- **`requestDefaults`** — shared `baseURL`/`headers`/`url` applied to every
  request; works together with each operation's own `routing`.
- **`methods.loadOptions`** — dynamic dropdown population via a declarative
  `routing` block (its own `request` + `output` with `postReceive` steps like
  `rootProperty`, `setKeyValue`, `sort`), e.g.:
  ```js
  methods: {
    loadOptions: {
      routing: {
        request: { url: '/webhook/example', method: 'GET' },
        output: { postReceive: [ /* ... */ ] },
      },
    },
  }
  ```
- **`version`** — declarative nodes **must use the "light" versioning
  approach** (a plain number, not the multi-directory full-versioning scheme)
  — full versioning requires programmatic style.
- **`features`** — named feature flags scoped to node versions, referenced
  from `displayOptions` via `@feature`, to control parameter visibility across
  versions.

## Programmatic-style-only parameters and the `execute()` method

For the full worked `execute()` implementation (input-item loop,
`getNodeParameter`, `httpRequestWithAuthentication`,
`constructExecutionMetaData`, `continueOnFail` error handling, return shape),
see [07b-tutorial-programmatic.md](07b-tutorial-programmatic.md) — that
tutorial's step 4 is the confirmed, real contract (this file previously had
only a partial, unconfirmed sketch of it).

Other programmatic-only base-file fields: `defaultVersion` (number, used with
full versioning), `methods`/`loadOptions` (same idea as declarative's, but you
implement the fetch yourself instead of describing it with `routing`),
`version` (number *or* array — programmatic nodes may use full versioning),
`features` (same feature-flag mechanism as declarative).

## Known gap — OAuth2 credentials
`build-your-node/reference/credentials-files.md` only documents generic
authentication (header/qs/body/basic-auth) — confirmed by reading its actual
outgoing links, there is no linked OAuth2 sub-page in this doc tree. See the
note in [10-reference-credentials-files.md](10-reference-credentials-files.md).
