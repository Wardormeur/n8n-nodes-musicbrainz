# Reference: credentials files (`<Node>Api.credentials.ts`)

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/credentials-files.md

Defines the node's authorization method. Its settings control what n8n shows
in the **Credentials** modal.

## Structure
1. Imports from `n8n-workflow`.
2. A class implementing `ICredentialType`.
3. Property definitions describing the input fields + how to authenticate.

| Field | Purpose |
|---|---|
| `name` | internal identifier, referenced from the node's `credentials` array |
| `displayName` | label shown in the Credentials modal |
| `documentationUrl` | link to the target API's auth docs |
| `icon` | **required by lint** (`cred-class-field-icon-missing`, `icon-validation`), though the docs page doesn't list it. Type `Icon` from `n8n-workflow`; `{ light, dark }` like the node's. See below. |
| `properties` | `INodeProperties[]` — the input fields (`displayName`, `name`, `type`, `default`, optionally `typeOptions: { password: true }`) |
| `authenticate` | how n8n injects the credential into outgoing requests (generic auth, see below) |
| `test` | an `ICredentialTestRequest` — a `request` (baseURL + url) n8n calls to verify the credential works |

## Generic authentication (`IAuthenticateGeneric`), four shapes

Header-based:
```ts
authenticate: IAuthenticateGeneric = {
	type: 'generic',
	properties: { headers: { Authorization: '=Bearer {{$credentials.authToken}}' } },
};
```

Query string:
```ts
properties: { qs: { token: '={{$credentials.token}}' } }
```

Request body:
```ts
properties: { body: { username: '={{$credentials.username}}', password: '={{$credentials.password}}' } }
```

Basic auth:
```ts
properties: { auth: { username: '={{$credentials.username}}', password: '={{$credentials.password}}' } }
```

## Test request
```ts
test: ICredentialTestRequest = {
	request: { baseURL: 'https://api.example.com', url: '/me' },
};
```

## Credential icon
The official lint plugin fails a credential class without `icon`. The
docs page and both tutorial examples (here and in
[07-tutorial-declarative.md](07-tutorial-declarative.md)) omit it, so it's
easy to miss. Reuse the node's icon files. The path is relative to the
compiled credential in `dist/credentials/`, and `scripts/copy-assets.js`
puts the icons in `dist/nodes/<Name>/`:
```ts
import type { Icon } from 'n8n-workflow';

icon: Icon = {
	light: 'file:../nodes/<Name>/<name>.svg',
	dark: 'file:../nodes/<Name>/<name>.dark.svg',
};
```
Lint-checked and loaded by n8n 2.37.10 (MusicBrainz node, 2026-10-17).
How the credential icon renders in the editor hasn't been checked.

## Full example (API-key-in-query-string)
As on the docs page. Add an `icon` (above) before linting.
```ts
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
		properties: { qs: { api_key: '={{$credentials.apiKey}}' } },
	};
	test: ICredentialTestRequest = {
		request: { baseURL: 'https://api.nasa.gov', url: '/apod' },
	};
}
```

## Session-based APIs: `preAuthentication` and when it refreshes
For APIs that log in first and then send a session token, n8n has a
credential hook (n8n 2.37.10 source, not in the docs):
- A `hidden` property with `typeOptions: { expirable: true }` holds the
  session (e.g. `sessionToken`), and `authenticate` sends it
  (`headers: { 'X-Session': '={{$credentials.sessionToken}}' }`).
- `async preAuthentication(this: IHttpRequestHelper, credentials)` logs in
  with `this.helpers.httpRequest` and returns `{ sessionToken: ... }`.
  Precedent: `BaserowApi`, `Auth0ManagementApi` in n8n-nodes-base.
- **When it runs** (`credentials-helper.js` `preAuthentication`,
  `request-helpers/authentication.js`): only when the expirable field is
  empty, when testing the credential, or **after a request fails with HTTP
  401**. Its result is **saved into the stored credential**, so one session
  is reused across executions.
- **So it only fits APIs that answer an expired session with 401.** If the
  API uses another status (the Freebox answers 403 `auth_required`), n8n
  never refreshes the saved session and every request fails once it
  expires. Check the API's expired-session status before choosing this.
  Otherwise go programmatic and open the session in the node (per
  execution, re-opening on the API's expired-session error).

## Credential tests that need more than one request (`testedBy`)
A credential's `test` is one static request, so it can't log in first
(challenge, HMAC, session). For that, the node tests the credential itself:
- On the node: `credentials: [{ name: 'xApi', required: true, testedBy: 'xApiTest' }]`
  and `methods = { credentialTest: { async xApiTest(this: ICredentialTestFunctions, credential: ICredentialsDecrypted) { ...; return { status: 'OK', message } } } }`
  (return `{ status: 'Error', message }` on failure).
- **Its `this.helpers` has only the legacy `request`** (request-promise
  style options: `uri`, `resolveWithFullResponse`, `simple: false`,
  `rejectUnauthorized`) plus SSH-tunnel helpers: n8n-core 2.37.10
  `CredentialTestContext`. There is no `httpRequest`, so the lint rule
  `no-deprecated-workflow-functions` can't be satisfied there; disable it on
  that one line with a comment saying why. A small adapter from httpRequest
  options to request options lets the test reuse the node's own login code.
- Verified 2026-10-25 with the Freebox node (session-based API): lint clean
  apart from the documented disable; the login code it reuses ran live.

## Known gap — OAuth2 credentials
Confirmed (by reading this page's actual outgoing links, not guessing sibling
URLs): `credentials-files.md` only links to `node-ui-elements.md`. It does
**not** cover OAuth2 or predefined/generic credential types at all in this
version of the doc tree — this isn't a broken link, the content simply isn't
here. For an OAuth2-authenticated API, study an existing OAuth2 node/credential
pair in `packages/nodes-base/credentials` of `github.com/n8n-io/n8n` (look for
a standalone OAuth2 `ICredentialType` with `extends: ['oAuth2Api']` or fields
like `authUrl`, `accessTokenUrl`, `clientId`, `clientSecret`, `scope`,
`authQueryParameters`, `authentication`). Re-check this page on the next
refresh in case n8n adds OAuth2 coverage later.

Also unconfirmed: whether an OAuth2 credential (`extends: ['oAuth2Api']`) can
*also* carry its own `authenticate: IAuthenticateGeneric` block to inject an
extra static header (e.g. a required `User-Agent`) alongside the bearer
token, or whether one overrides the other. Nobody has tested this against a
running n8n with a real OAuth2 authorization. Don't rely on it without a
live test; if the API requires a static header on every call, the simplest
safe option is to also put that header in the node's `requestDefaults.headers`
when it doesn't depend on a credential value.

## Nodes that declare more than one credential
Confirmed against a running n8n (n8n@2.37.10, 2026-09-06 to 09-09, while
building `n8n-nodes-musicbrainz`). The authoring docs don't cover any of
this. These rules apply to a declarative node whose `credentials` array has
two or more entries, e.g. an API key for read operations plus OAuth2 for
write operations.

### Rule 1 — there must be a node parameter named exactly `authentication`
`RoutingNode.prepareCredentials()` (`n8n-core`, `execution-engine/routing-node.js`)
does this whenever `credentials.length > 1`: it calls
`getNodeParameter('authentication', 0)` and picks the credential entry whose
`displayOptions.show.authentication` array contains that value. It does
**not** look at `resource`, `operation`, or any other parameter. Without a
parameter named `authentication`, **every** operation fails with
`Could not get parameter "authentication"`, including operations that only
need one of the credentials.

```ts
credentials: [
	{ name: 'myServiceApi', required: true,
	  displayOptions: { show: { authentication: ['apiKey'] } } },
	{ name: 'myServiceOAuth2Api', required: true,
	  displayOptions: { show: { authentication: ['oAuth2'] } } },
],
properties: [
	{
		displayName: 'Authentication',
		name: 'authentication',
		type: 'options',
		options: [
			{ name: 'API Key', value: 'apiKey' },
			{ name: 'OAuth2', value: 'oAuth2' },
		],
		default: 'apiKey', // must be a plain value — see Rule 2
	},
	// ...resource, operation, etc.
],
```

### Rule 2 — `authentication` must not be an expression
It's tempting to make `authentication` a hidden field whose `default` is an
expression computed from `resource`, e.g.
`={{ ["tag","rating"].includes($parameter.resource) ? "oAuth2" : "apiKey" }}`.
That works at **runtime** (`prepareCredentials` evaluates the expression), but
breaks the **editor**. The editor decides what to show with
`displayParameter()` (`n8n-workflow`, `node-helpers.js`), which reads the raw
stored value without evaluating it:
```js
if (values.some((v) => typeof v === 'string' && v.charAt(0) === '=')) {
  return true; // can't evaluate an expression here, so show it
}
```
The result is that **both** credential rows always show in the node panel,
including an inert extra "Select Credential" row. Confirmed that switching
`resource` doesn't change which rows show: the check never evaluates the
expression. A plain static `default` (e.g. `'apiKey'`) removes the extra row.

### Rule 3 — a parameter that credentials filter on is never shown in the panel
Any parameter referenced as a key in some `credentials[].displayOptions.show`
is left out of the node's parameter panel entirely, whatever its `type`. This
was confirmed by making `authentication` a visible `options` field (it still
didn't render) and then by renaming it to `authMethodDIAGNOSTIC` everywhere
(still didn't render). It's not about the name, it's structural. The exact
frontend source line wasn't found. The consequence is that **users cannot
switch the `authentication` value themselves** in the node panel. It stays
at its `default`.

### What this means for the design
Taken together, Rules 2 and 3 mean a named-credential node can't have **both**
(a) automatic switching of the credential by resource, and (b) a manual
switch the user can actually see. No workaround has been found. Before
building, pick one of these on purpose rather than finding out mid-build:

| Option | Behavior | Cost |
|---|---|---|
| **A. One credential type per node** (e.g. separate read and write nodes, or OAuth2 only) | Avoids the whole mechanism; no `authentication` parameter needed | More nodes, or forcing OAuth2 on read-only users |
| **B. Expression `default` on `authentication`** (Rule 2) | Correct credential chosen at runtime per resource | Both credential rows always show in the editor; harmless to execution but confusing |
| **C. Static `default`** | Clean single credential row | Only one credential is ever usable; fine only while every implemented operation needs the same credential |

Option C is only a stopgap. It stops being enough once any operation needs
the other credential. If the API's write operations need OAuth2 and its read
operations work with either credential, consider whether OAuth2 alone
(Option A) covers everything before reaching for two credential types.

Note that the `n8n-node` CLI wizard only scaffolds one auth method, so a
two-credential node has to be hand-built anyway (see
[07c-node-cli-tool.md](07c-node-cli-tool.md#when-the-wizard-cant-be-used--hand-build-instead)).

**Stability caveat.** Rules 1 and 2 come from reading n8n's compiled source
for n8n@2.37.10 (`n8n-core/dist/execution-engine/routing-node.js`,
`n8n-workflow/dist/node-helpers.js`) and were reproduced live. Rule 3 is
confirmed by behavior only, with no source line pinned down. All three are
internal behavior, not a published contract. Re-check them on this skill's
next source-verification pass. These are claims about **editor display**
behavior, a separate category from authoring-shape claims (docs) and
runtime-execution claims (engine source), and verified differently: by
opening the node in a real editor.

## Testing credentials safely
This skill's own recommendation, not part of n8n's documented guidance — but
worth following for any credential type that involves either a real secret
or a real third-party account with side effects.

- **Not every credential is a secret.** A required field like a descriptive
  User-Agent string or a public client identifier isn't sensitive — no
  special handling needed. The care below is specifically for API keys,
  OAuth2 client secrets, and tokens.
- **Never hardcode a real secret into anything committed** — not the node
  code, not a test fixture, not a README example.
- **If the credential authorizes a real third-party account with write
  access** (OAuth2 or otherwise) **and the node has write operations, use a
  dedicated/throwaway account for testing, not a personal or production
  one.** A bug in a hand-built request body can produce a real, visible
  mutation (a bad tag, a corrupted record, a deleted item) against whatever
  account is authorized — isolate that risk before it's a real account.
- **Scope down what you authorize while testing one operation at a time,
  if the credential type supports granular scopes.** Requesting only the
  scope the operation under test actually needs narrows the blast radius of
  a bug during that session, even if the shipped node's credential defaults
  to requesting everything a typical user would want.
- **Use the credential's own `test` request (above) as the first, narrowest
  check** before testing any node operation — it isolates "is auth wired up
  at all" from "does this specific operation work," so a failure is easier
  to place.

### Concrete technique: seed test credentials from environment variables
Don't hand-type secrets into n8n's Credentials UI every test session — put
them in local environment variables (or a `.env` file loaded by a small
script, itself listed in `.gitignore`) and seed the local dev n8n instance's
credential store from those non-interactively:

1. n8n's CLI ships `n8n import:credentials --input=<file.json>` (confirmed:
   `docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line`), which
   reads a JSON array of `{ id, name, type, data, ... }` objects. Confirmed
   in `n8n-io/n8n`'s `packages/cli/src/commands/import/credentials.ts`:
   `readCredentials()` calls `cipher.encryptV2()` on any `data` field given
   as a plain object, so a plaintext `data` object gets encrypted into n8n's
   store on import — you never write the plaintext into n8n's DB by hand.
2. Write a small (uncommitted, or committed-but-secret-free — it should only
   contain `process.env.X` references, never a literal) script that reads
   the needed env vars and builds one object per credential: `type` is the
   credential class's own `name` (e.g. `musicBrainzApi`), `data` is a plain
   object keyed by that credential type's `properties[].name` fields (e.g.
   `{ userAgent: process.env.MB_TEST_USER_AGENT }`), matching whatever
   `<Node>Api.credentials.ts` actually declares.
3. Write that array to a temp JSON file, run
   `n8n import:credentials --input=<temp file>`, then delete the temp file.
   This is repeatable across test runs/machines and never touches a
   committed file with a real secret in it.

   **Template: `templates/scripts/seed-credential.cjs`** (copied by
   `scaffold.mjs`) does steps 2-3. Fill its `CONFIG` (credential type,
   display name, a stable ID so re-runs overwrite, and field name ->
   environment variable), put the values in `.env` (in `.gitignore`), and
   run `node scripts/seed-credential.cjs`. It masks the secrets in n8n's
   output. Verified 2026-10-20 (Discogs): imported, then a live run with
   the credential succeeded. If the user pastes a secret into the chat,
   write it to `.env` with the Write tool and never echo it in a command or
   its output.
4. **This doesn't fully cover OAuth2.** `clientId`/`clientSecret` seed the
   same way, but the authorize-and-exchange step (obtaining an actual
   access/refresh token) still needs one interactive pass through n8n's
   Credentials UI per third-party account — env vars only remove the need to
   hand-type the non-interactive fields, not the OAuth dance itself.
5. **This is a separate concern from `references/18-reference-verification-guidelines.md`'s
   "must not touch environment variables or read/write the filesystem" rule.**
   That rule restricts the node's own shipped runtime code (what runs inside
   `execute`/`preSend`/etc. when a user's workflow executes it). The seeding
   script above runs entirely outside the node's code, at dev-machine setup
   time, using n8n's own CLI — it's tooling around the node, not code in it.

**Stability caveat.** Split by confirmation source: that `import:credentials
--input=<file.json>` exists and takes a JSON array is doc-confirmed
(`docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line`) — solid.
The specific mechanism this technique leans on — that `readCredentials()`
auto-encrypts a plaintext `data` object via `cipher.encryptV2()` rather than
requiring pre-encrypted input — is read directly from
`packages/cli/src/commands/import/credentials.ts` with no doc backing it;
it's an internal CLI implementation detail, not a published contract. If a
future n8n version changes what shape `import:credentials` expects for
`data`, this technique (not the command's existence) is what would break —
re-verify against current source if it stops working, and re-check on this
skill's next refresh.
