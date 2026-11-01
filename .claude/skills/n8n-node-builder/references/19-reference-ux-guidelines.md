# Reference: UX guidelines for verified community nodes

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines.md

Stricter/more specific bar than the general
[04-node-ui-design.md](04-node-ui-design.md) — apply this when the node is
headed for n8n verification, not just "any working node."

## Credentials
- API keys and any sensitive credential value **must** be a password-type
  field.
- If the target API supports OAuth, the node **must** offer OAuth as an
  auth option (not just API key/basic auth).

## Node structure
- Implement CRUD consistently per resource: **Create, Get, Update, Delete,
  Upsert, Get Many** — use exactly these names where applicable, don't invent
  synonyms per-resource.
- **Get Many** wording (quoted from the live page by a targeted fetch,
  2026-10-17; this section was missing from the original capture):
  - It is "also used when some filtering or search is available".
  - "always specify the object of the operation: for example, `Get Many Rows`
    or `Get Many Records`."
  - "You can omit `Many`: `Get Many Rows` can be `Get Rows`."
  - "You can enhance certain 'Get Many' operations by providing users with
    sorting options."
  - Its paging parameters are the Return All + Limit pair, which the docs
    don't state. See [24-reference-pagination.md](24-reference-pagination.md).
- Use **Resource Locator** (see
  [11-reference-ui-elements.md](11-reference-ui-elements.md)) for single-item
  selection, defaulting to "From list" mode rather than raw ID entry.

## Copy standards
- Node names: Title Case.
- Action names and descriptions: Sentence case.
- Match the third-party service's own UX terminology, not its raw API
  field/endpoint names.
- Parameter placeholders start with "e.g." and use camelCase for any code-like
  example value.

## Operation-level naming (per operation object)
- `name` — Title Case; don't repeat the resource name if it's already shown
  elsewhere in the UI.
- `action` — Sentence case; *do* include the resource name here even if it's
  visible above (this is the string shown in the node's action picker).
- `description` — Sentence case; phrase it as a genuinely useful clarification,
  not a restatement of the name.

## Functional requirements
- A **Delete** operation must return `{"deleted": true}` on success.
- Any endpoint whose response has more than ~10 fields needs a "Simplify"
  toggle (same pattern as the "Simplify Response" convention in
  [04-node-ui-design.md](04-node-ui-design.md)).
- AI-tool-usable nodes (`usableAsTool: true`) need an **"Output"** parameter
  in place of a plain Simplify toggle. See the next section.

### AI-tool nodes: the "Output" parameter
The page has a full section on this, contrasted with a separate "Normal
nodes: 'Simplify' parameter" section. The reason it gives: when an AI agent
calls a node as a tool, the whole response goes into the model's context,
and tools may run out of context window on large raw responses. So the
node offers three output modes instead of on/off:
- **Simplified**: a curated subset of the most useful fields (the default).
- **Raw**: the full response, unchanged.
- **Selected Fields**: only the fields the user picks. The entity's **ID is
  always included**, whatever the user picked (the page states this default).

The page itself doesn't give parameter names or values. Use the only
production precedent in `n8n-io/n8n`:
`packages/nodes-base/nodes/Microsoft/Entra/descriptions/UserDescription.ts`
(and `GroupDescription.ts`, PR #11779). Every other `usableAsTool` vendor
node, OpenAI and Anthropic included, still uses a boolean Simplify. The
`node-usable-as-tool` lint rule doesn't check for this pattern; it only
checks that `usableAsTool` is present. So the pattern is required by the
docs, not enforced by tooling, and new.

**Implementation: copy `templates/nodes/__NodeName__/actions/output.ts`**
and its test (`__tests__/output.test.ts`, 10 tests). It provides:
- `buildOutputProperties(show, fieldOptions)`: the parameter `output`
  (values `simple`/`raw`/`fields`, default `simple`) plus a `multiOptions`
  field named `fields`, shown only in Fields mode. Call it once per operation
  with that operation's `show` and the entity's field options. Don't copy the
  properties into each operation file.
- `applyOutputMode(...)`: the pure trimming function. In `fields` mode it
  always keeps `id`.
- `outputSingle(simplifiedFields, include?)` and
  `outputList(listKey, simplifiedFields, include?)`: `postReceive` hooks (see
  [21-reference-routing-hooks.md](21-reference-routing-hooks.md)) for a
  single-object response and for a `{ <listKey>: [...] }` list response that
  should become one item per entity.
- **If the operation has an "Include"-style option** (extra data the API
  adds on request), pass `include: { parameter, responseKeys }`. Otherwise
  Simplified mode silently drops the data the user just asked for.
  `parameter` can be a dotted path such as `'options.include'` (n8n's
  `getNodeParameter` resolves it with `lodash/get`). `responseKeys` maps a
  selected value to the response key it adds when they differ, e.g.
  `{ ratings: 'rating', 'url-rels': 'relations' }`.

The template takes the `fields` choices as static options per entity, which
is enough when the field shape is known. The Entra precedent instead
populates them with a `loadOptionsMethod` that reads the active `resource`.
Either beats a free-text comma-separated list. Both shapes have been checked
end-to-end against a live n8n. With the loadOptions variant (MusicBrainz,
2026-09-08), choosing Name + Country returned exactly `{name, country, id}`.
With the static variant (MusicBrainz, 2026-10-11/17), choosing Name +
Life Span + Aliases returned those plus `id`.

## Error messages
Explain what happened and how to fix it. Avoid bare negative words like
"error" or "failure" in the message text — write toward resolution, not blame
(this pairs with the `NodeApiError`/`NodeOperationError` `message`/
`description` fields in
[08e-reference-error-handling.md](08e-reference-error-handling.md)).

Worked example n8n points to: Airtable's `Record: Search` operation —
https://github.com/n8n-io/n8n/blob/92e2a8e61a4189025e5d4bac8be81576b624fe85/packages/nodes-base/nodes/Airtable/v2/actions/record/search.operation.ts#L85-L135

## How much of this is actually checked by tooling — treat this as a manual checklist
`npm run lint` and `npx @n8n/scan-community-package` both run the same
official plugin, `@n8n/eslint-plugin-community-nodes` (confirmed via
`n8n-io/n8n` PR #19660). It checks package shape, security, credentials and
node structure. **None of its rules check the copy rules on this page**:
Title Case vs Sentence case, the exact Create/Get/Update/Delete/Upsert/Get
Many strings, description punctuation, `e.g.`-prefixed placeholders,
singular resource naming. Rules with copy-sounding names were checked
against their own messages: `valid-description` is package.json's
description, and `resource-operation-pattern` only flags more than 5
operations with no resources. A clean lint is not a UX review.

Checked on v0.35.0 (44 recommended rules, 2026-10-17). The full rule list is
kept as data in `references/sources.json` (`rule_snapshot`), not here.
`scripts/check-skill.mjs --package <node package>` reports rules the
installed plugin has that the snapshot doesn't, with their messages. The
plugin grows fast (10 rules at PR #19660, 42 by v0.31.0, 44 by v0.35.0), and
an unpinned install can pull new rules between two builds.

Rules a build actually runs into, and what to do about them:
- **Package rules only run if `eslint.config.mjs` covers `package.json`**
  with the TS parser; otherwise they are skipped without a word. Copy
  `templates/eslint.config.mjs`. See
  [14-node-linter.md](14-node-linter.md#hand-built-packages-writing-eslintconfigmjs-yourself).
- **The plugin peer-pins `eslint` `9.29.0` exactly** (0.31.0 to 0.35.1), so
  a newer `eslint` fails `npm install`. See
  [25-tooling-and-environment.md](25-tooling-and-environment.md).
- `no-unsafe-connection-type-cast` (error): no `as never` / `as any` /
  `as unknown` on the description's `inputs`/`outputs`. Write
  `[NodeConnectionTypes.Main]` uncast, as the templates do.
- `valid-node-categories` (error): codex `categories` must be a non-empty
  array from the 10 values in
  [09-reference-codex-files.md](09-reference-codex-files.md). `"Marketing"`
  must be `"Marketing & Content"`.
- `node-usable-as-tool` only checks that `usableAsTool` is *present*, and
  suggests `true`. This skill always sets `true` on action nodes (see
  [07-tutorial-declarative.md](07-tutorial-declarative.md)), which brings
  in the Output parameter.
- `cred-class-oauth2-naming`: an OAuth2 credential class ends in
  `OAuth2Api`, and its `name`/`displayName` contain "OAuth2".

Copy-style checks do exist as ESLint rules (e.g.
`node-param-display-name-miscased`, `node-param-option-name-wrong-for-upsert`,
`node-param-option-name-wrong-for-get-many`,
`node-param-description-missing-final-period`,
`node-param-resource-with-plural-option`), but only in a separate,
third-party-maintained package, `eslint-plugin-n8n-nodes-base`
(`github.com/ivov/eslint-plugin-n8n-nodes-base`), not in the official plugin
that the scaffold wires up or that `scan-community-package` runs. It can be
added as an extra devDependency for the mechanical subset it covers (no
conflict with the "zero runtime dependencies" rule, same reasoning as
[12-test-your-node.md](12-test-your-node.md)'s unit-test devDependency
note). Treat it as a supplement: it isn't maintained alongside docs.n8n.io,
so it may not track this page, and it can't judge anything about the
specific third-party API.

**What has no automated check at all, on either plugin** — these need an
actual manual read-through against this page and
[04-node-ui-design.md](04-node-ui-design.md), ideally by someone who has used
the real third-party service: terminology matching the service's own
vocabulary, whether progressive disclosure/field grouping choices make sense,
whether an error message is genuinely resolution-oriented rather than just
non-bare, and whether a "Simplify" toggle is actually warranted for a given
endpoint's response shape.
