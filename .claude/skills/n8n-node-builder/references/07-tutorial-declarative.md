# Tutorial: build a declarative-style node

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/tutorial-build-a-declarative-style-node.md

Worked example: a node for NASA's API (Astronomy Picture of the Day + Mars
Rover Photos). This is the canonical template — mirror this shape for new
declarative nodes.

## Prerequisites
git, Node.js ≥18.17.0 (nvm recommended), npm, basic TS/REST/git knowledge.

## 1. Project setup
Start from the starter repo (or `npm create @n8n/node`, the newer scaffolder
mentioned in the deployment docs):
```shell
git clone https://github.com/<your-organization>/<your-repo-name>.git n8n-nodes-nasa-pics
cd n8n-nodes-nasa-pics
npm i
```
Delete the example scaffolding: `nodes/Example`, `nodes/GithubIssues`,
`credentials/GithubIssuesApi.credentials.ts`,
`credentials/GithubIssuesOAuth2Api.credentials.ts`.

Create:
```
nodes/NasaPics/
├── NasaPics.node.json
└── NasaPics.node.ts
credentials/
└── NasaPicsApi.credentials.ts
```

## 2. Icon
Drop an SVG (preferred) as `nodes/NasaPics/nasapics.svg`. PNG alternative must
be 60×60px.

## 3. Node file (`NasaPics.node.ts`)

Imports:
```typescript
import { NodeConnectionTypes } from 'n8n-workflow';
import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
```

Class shell — **class name must match the filename**:
```typescript
export class NasaPics implements INodeType {
	description: INodeTypeDescription = {
		// Basic node details
		properties: [
			// Resources and operations
		]
	};
}
```

Basic node details:
```typescript
displayName: 'NASA Pics',
name: 'nasaPics',
icon: 'file:nasapics.svg',
group: ['transform'],
version: 1,
subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
description: 'Get data from NASAs API',
defaults: {
	name: 'NASA Pics',
},
usableAsTool: true,
inputs: [ NodeConnectionTypes.Main ],
outputs: [ NodeConnectionTypes.Main ],
credentials: [
	{
		name: 'NasaPicsApi',
		required: true,
	},
],
requestDefaults: {
	baseURL: 'https://api.nasa.gov',
	headers: {
		Accept: 'application/json',
		'Content-Type': 'application/json',
	},
},
```

**Action nodes always set `usableAsTool: true`** (the user's standing rule;
the lint rule `node-usable-as-tool` asks for the property and suggests
`true`). n8n itself has no default that makes this automatic, and setting
it has consequences beyond this one line. It makes the node callable by n8n's AI Agent node, with
arguments resolvable via `$fromAI()` at runtime instead of only static UI
config. If set:
- `references/19-reference-ux-guidelines.md`'s "Functional requirements"
  requires an **"Output" parameter offering Simplified / Raw / Selected
  Fields modes** — a distinct three-way pattern, not just the general
  "Simplify Response" toggle in `references/04-node-ui-design.md`.
- Add the AI-tool fixture from `references/12-test-your-node.md`'s "Which
  fixture workflows to build" — tool-invoked parameter resolution is a
  different code path from every other fixture, so testing the node's normal
  UI doesn't cover it.
- Tool-invoked execution also uses a **separate error/retry path** from an
  ordinary action-node run — see
  `references/23-reference-node-runtime-settings.md`'s section on this. A
  thrown error's `description` still surfaces, but it fails the whole agent
  run rather than becoming a retryable observation the model can self-correct
  from — don't assume the model gets a soft failure signal.

So every action node gets the Output parameter
(`templates/nodes/__NodeName__/actions/output.ts`, `scaffold.mjs
--usable-as-tool`) and the AI-tool fixture. Only a trigger-only node leaves
it out.

Resource selector:
```typescript
{
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Astronomy Picture of the Day', value: 'astronomyPictureOfTheDay' },
		{ name: 'Mars Rover Photos', value: 'marsRoverPhotos' },
	],
	default: 'astronomyPictureOfTheDay',
}
```

Operations, scoped to a resource via `displayOptions.show`, with routing inline:
```typescript
{
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['astronomyPictureOfTheDay'] } },
	options: [
		{
			name: 'Get',
			value: 'get',
			action: 'Get the APOD',
			description: 'Get the Astronomy Picture of the day',
			routing: { request: { method: 'GET', url: '/planetary/apod' } },
		},
	],
	default: 'get',
},
{
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['marsRoverPhotos'] } },
	options: [
		{
			name: 'Get',
			value: 'get',
			action: 'Get Mars Rover photos',
			description: 'Get photos from the Mars Rover',
			routing: { request: { method: 'GET' } },
		},
	],
	default: 'get',
},
```

Per-resource fields, with routing that builds the URL/query string from the
parameter's own value (`$value`):
```typescript
{
	displayName: 'Rover name',
	description: 'Choose which Mars Rover to get a photo from',
	required: true,
	name: 'roverName',
	type: 'options',
	options: [
		{ name: 'Curiosity', value: 'curiosity' },
		{ name: 'Opportunity', value: 'opportunity' },
		{ name: 'Perseverance', value: 'perseverance' },
		{ name: 'Spirit', value: 'spirit' },
	],
	routing: { request: { url: '=/mars-photos/api/v1/rovers/{{$value}}/photos' } },
	default: 'curiosity',
	displayOptions: { show: { resource: ['marsRoverPhotos'] } },
},
{
	displayName: 'Date',
	description: 'Earth date',
	required: true,
	name: 'marsRoverDate',
	type: 'dateTime',
	default: '',
	displayOptions: { show: { resource: ['marsRoverPhotos'] } },
	routing: {
		request: { qs: { earth_date: '={{ new Date($value).toISOString().substr(0,10) }}' } },
	},
}
```

Optional fields grouped under a collapsible collection:
```typescript
{
	displayName: 'Additional Fields',
	name: 'additionalFields',
	type: 'collection',
	default: {},
	placeholder: 'Add Field',
	displayOptions: {
		show: { resource: ['astronomyPictureOfTheDay'], operation: ['get'] },
	},
	options: [
		{
			displayName: 'Date',
			name: 'apodDate',
			type: 'dateTime',
			default: '',
			routing: { request: { qs: { date: '={{ new Date($value).toISOString().substr(0,10) }}' } } },
		},
	],
}
```

## 4. Credentials (`NasaPicsApi.credentials.ts`)
```typescript
import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NasaPicsApi implements ICredentialType {
	name = 'NasaPicsApi';
	displayName = 'NASA Pics API';
	documentationUrl = 'https://docs.n8n.io/integrations/creating-nodes/build/declarative-style-node/';
	properties: INodeProperties[] = [
		{ displayName: 'API Key', name: 'apiKey', type: 'string', default: '' },
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { qs: { 'api_key': '={{$credentials.apiKey}}' } },
	};
	test: ICredentialTestRequest = {
		request: { baseURL: 'https://api.nasa.gov', url: '/apod' },
	};
}
```

This example has no `icon`, and the official lint plugin fails a
credential without one. See
[10-reference-credentials-files.md](10-reference-credentials-files.md#credential-icon).

## 5. Codex file (`NasaPics.node.json`)
```json
{
	"node": "n8n-nodes-nasapics",
	"nodeVersion": "1.0",
	"codexVersion": "1.0",
	"categories": ["Miscellaneous"],
	"resources": {
		"credentialDocumentation": [{ "url": "" }],
		"primaryDocumentation": [{ "url": "" }]
	}
}
```

## 6. `package.json`
```json
{
	"name": "n8n-nodes-nasapics",
	"version": "0.1.0",
	"description": "n8n node to call NASA's APOD and Mars Rover Photo services.",
	"keywords": ["n8n-community-node-package"],
	"license": "MIT",
	"homepage": "https://n8n.io",
	"author": { "name": "Test", "email": "test@example.com" },
	"repository": { "type": "git", "url": "git+<your-repo-url>" },
	"main": "index.js",
	"files": ["dist"],
	"n8n": {
		"n8nNodesApiVersion": 1,
		"credentials": ["dist/credentials/NasaPicsApi.credentials.js"],
		"nodes": ["dist/nodes/NasaPics/NasaPics.node.js"]
	}
}
```

## Testing
```shell
npm install n8n -g
npm run build
npm link
npm link <node-package-name>   # run from the n8n custom dir, see 13-run-locally.md
n8n start
```
Search for the node by its **display name** ("NASA Pics"), not the package name.

## Next steps
Deploy it (see [15-deploy-your-node.md](15-deploy-your-node.md)); n8n's own
**Brevo** node is cited as a good declarative reference to study; look into
node versioning for anything beyond a v1 node.
