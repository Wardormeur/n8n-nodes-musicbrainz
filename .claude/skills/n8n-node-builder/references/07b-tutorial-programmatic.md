# Tutorial: build a programmatic-style node

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/tutorial-build-a-programmatic-style-node.md

Worked example: a node for SendGrid's API ("FriendGrid" — create a contact).
This is the canonical template for programmatic nodes — mirror this shape,
the way [07-tutorial-declarative.md](07-tutorial-declarative.md) is the
template for declarative ones.

## Prerequisites
git, Node.js ≥18.17.0, npm, JS/TS + REST + git + n8n-expressions knowledge.

## 1. Project setup
```shell
git clone https://github.com/<your-organization>/<your-repo-name>.git n8n-nodes-friendgrid
cd n8n-nodes-friendgrid
npm i
```
Delete: `nodes/Example`, `nodes/GithubIssues`,
`credentials/GithubIssuesApi.credentials.ts`,
`credentials/GithubIssuesOAuth2Api.credentials.ts`.

Create:
```
nodes/FriendGrid/
├── FriendGrid.node.json
└── FriendGrid.node.ts
credentials/
└── FriendGridApi.credentials.ts
```

## 2. Icon
SVG (preferred) as `nodes/FriendGrid/friendGrid.svg`; PNG must be 60×60px, square.

## 3. Node base file (`FriendGrid.node.ts`)

Imports — note the extra types needed for a programmatic node vs a declarative one:
```typescript
import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
```

Class shell — the `execute()` method sits alongside `description`:
```typescript
export class FriendGrid implements INodeType {
	description: INodeTypeDescription = {
		// Details here
		properties: [
			// Resources/operations here
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	}
}
```

Node details (no `requestDefaults` here — that's declarative-only; the
request is built by hand in `execute()`):
```typescript
displayName: 'FriendGrid',
name: 'friendGrid',
icon: 'file:friendGrid.svg',
group: ['transform'],
version: 1,
description: 'Consume SendGrid API',
defaults: {
	name: 'FriendGrid',
},
inputs: [NodeConnectionTypes.Main],
outputs: [NodeConnectionTypes.Main],
usableAsTool: true,
credentials: [
	{
		name: 'friendGridApi',
		required: true,
	},
],
```

**Action nodes always set `usableAsTool: true`** (the user's standing rule) — see
[07-tutorial-declarative.md](07-tutorial-declarative.md)'s note on this same
field: it's opt-in, makes the node callable by n8n's AI Agent node with
`$fromAI()`-resolved parameters, and requires an AI-tool-specific "Output"
parameter (`references/19-reference-ux-guidelines.md`) plus its own test
fixture (`references/12-test-your-node.md`) if actually enabled — and note
tool-invoked execution uses a separate error/retry path than a normal
`execute()` run, where a thrown error fails the whole agent run rather than
becoming something the model can retry from
(`references/23-reference-node-runtime-settings.md`). Decide this per node
rather than leaving the tutorial's example value in place.

Resource + operation (note: **no `routing` key anywhere** — that's the
tell-tale difference from declarative):
```typescript
{
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	options: [{ name: 'Contact', value: 'contact' }],
	default: 'contact',
	noDataExpression: true,
	required: true,
	description: 'Create a new contact',
},
{
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	displayOptions: { show: { resource: ['contact'] } },
	options: [
		{ name: 'Create', value: 'create', description: 'Create a contact', action: 'Create a contact' },
	],
	default: 'create',
	noDataExpression: true,
},
{
	displayName: 'Email',
	name: 'email',
	type: 'string',
	required: true,
	displayOptions: { show: { operation: ['create'], resource: ['contact'] } },
	default: '',
	placeholder: 'name@email.com',
	description: 'Primary email for the contact',
},
```

Optional fields, same "Additional Fields" collection pattern as declarative:
```typescript
{
	displayName: 'Additional Fields',
	name: 'additionalFields',
	type: 'collection',
	placeholder: 'Add Field',
	default: {},
	displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
	options: [
		{ displayName: 'First Name', name: 'firstName', type: 'string', default: '' },
		{ displayName: 'Last Name', name: 'lastName', type: 'string', default: '' },
	],
},
```

## 4. `execute()` method — the real contract, in full

```typescript
const items = this.getInputData();
let responseData;
const returnData: INodeExecutionData[] = [];
const resource = this.getNodeParameter('resource', 0);
const operation = this.getNodeParameter('operation', 0);

for (let i = 0; i < items.length; i++) {
	try {
		if (resource === 'contact') {
			if (operation === 'create') {
				const email = this.getNodeParameter('email', i);
				const additionalFields = this.getNodeParameter('additionalFields', i);
				const data: IDataObject = { email };
				Object.assign(data, additionalFields);

				const options: IHttpRequestOptions = {
					headers: { 'Accept': 'application/json' },
					method: 'PUT',
					body: { contacts: [data] },
					url: 'https://api.sendgrid.com/v3/marketing/contacts',
					json: true,
				};
				responseData = await this.helpers.httpRequestWithAuthentication.call(
					this, 'friendGridApi', options,
				);
				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData as IDataObject),
					{ itemData: { item: i } },
				);
				returnData.push.apply(returnData, executionData);
			}
		}
	} catch (error) {
		if (this.continueOnFail()) {
			const executionData = this.helpers.constructExecutionMetaData(
				this.helpers.returnJsonArray({ error: error.message }),
				{ itemData: { item: i } },
			);
			returnData.push.apply(returnData, executionData);
			continue;
		}
		throw error;
	}
}
return [returnData];
```

Key mechanics, confirmed from this worked example (this supersedes the
tentative/incomplete notes previously in
[08-reference-base-files.md](08-reference-base-files.md)):
- **Loop per input item** (`for (let i = 0; i < items.length; i++)`) —
  programmatic nodes process items one at a time, not in a single batch call.
- **`this.getNodeParameter(name, i)`** reads a parameter's value for item `i`
  (index `0` when reading something that isn't per-item, like `resource`/
  `operation` up front).
- **`this.helpers.httpRequestWithAuthentication.call(this, '<credentialName>', options)`**
  is the standard way to fire an authenticated request — it applies whatever
  the credential's `authenticate` block declares, so you don't hand-roll auth
  headers here.
- **`this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(data), { itemData: { item: i } })`**
  is the required pattern for turning a plain response object into properly
  paired `INodeExecutionData[]` — this is the "item pairing" the docs warn is
  mandatory.
- **Error handling**: wrap each item's work in `try/catch`; on failure, check
  `this.continueOnFail()` — if true, push an `{ error: error.message }` item
  and `continue` the loop instead of throwing, so one bad item doesn't kill
  the whole execution.
- **Return shape**: `return [returnData];` — an array of exactly one output
  branch containing all accumulated items (unless the node has multiple
  outputs).

## 5. Credentials (`FriendGridApi.credentials.ts`)
Same generic-auth shape as the declarative tutorial, just with a header
instead of a query string:
```typescript
import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FriendGridApi implements ICredentialType {
	name = 'friendGridApi';
	displayName = 'FriendGrid API';
	properties: INodeProperties[] = [
		{ displayName: 'API Key', name: 'apiKey', type: 'string', default: '' },
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
	};
	test: ICredentialTestRequest = {
		request: { baseURL: 'https://api.sendgrid.com/v3', url: '/marketing/contacts' },
	};
}
```

## 6. Codex file and `package.json`
Identical shape to the declarative tutorial (see
[07-tutorial-declarative.md](07-tutorial-declarative.md) steps 5–6), just with
`FriendGrid`/`friendgrid` names substituted throughout.

## Testing
Same flow as declarative — see [13-run-locally.md](13-run-locally.md):
```shell
npm install n8n -g
npm run build
npm link
npm link <node-package-name>
n8n start
```
