---
name: n8n-node-builder
description: Build custom n8n nodes/credentials for third-party APIs, and keep this skill's captured knowledge of n8n's node-creation docs (docs.n8n.io/connect/create-nodes) up to date. Use when the user asks to create/build/scaffold an n8n node or n8n integration for a service or API, to update/refresh/re-sync this skill's n8n docs knowledge, or mentions "n8n custom node", "n8n community node", "n8n-nodes-*" package.
---

# n8n node builder

Two jobs live here. Work out which one the user wants before doing anything:

- **Update knowledge** — re-crawl `docs.n8n.io/connect/create-nodes` and
  refresh `references/`. Do this if the user explicitly asks to update/refresh
  the docs, or if `references/sources.json`'s `last_full_refresh` is more than
  ~3 months old relative to today's date when this skill triggers for a build.
  Separately, also check `source_code_references.last_verified` in the same
  file — if that's more than ~3 months old, do the source-re-verification
  pass in Job 1's "Re-verifying source-derived findings" section below. The
  two dates track independent kinds of staleness and neither substitutes for
  the other.
- **Build a node** — scaffold (or extend) an n8n community node package for a
  named third-party API, using `references/` as the source of truth for n8n's
  conventions.

If the request is ambiguous, ask.

**Builder tools** live in this skill's `scripts/` folder (see
`references/25-tooling-and-environment.md`, which also lists the Windows/Git
Bash pitfalls that broke commands in past sessions; read it before running
shell commands). `scaffold.mjs` starts a package, `check-package.mjs` runs
the whole Step 7 checklist, `n8n-run.mjs` runs a fixture through the real
engine, `n8n-source.mjs` reads n8n's installed internals, `fetch-icon.mjs`
writes the node icons from the service's real logo, and
`check-skill.mjs` plus `sources-add.mjs` maintain this skill. Use them instead of retyping the
equivalent commands.

## Job 1: update knowledge

`references/sources.json` lists every doc page this skill has captured, each
mapped to a `references/<file>.md`. To refresh:

1. Read `references/sources.json`.
2. For **every** entry — not just ones you suspect changed — do a **two-pass**
   fetch. This two-pass approach is mandatory: a single-pass "extract full
   detailed content" prompt has previously caused this skill to silently miss
   9 real pages (recorded in `sources.json`'s `audit_history`), because the
   summarizing model drops link lists when asked a broad question.
   - **Pass A (links)**: `WebFetch` the `url` with a precise prompt: "List
     EVERY markdown link on this page verbatim as \"[text](url)\", every
     single hyperlink, no summarizing or omitting." Compare the result
     against `sources.json` — any URL under `/connect/create-nodes/` not
     already tracked is a page you're missing.
   - **Pass B (content)**: `WebFetch` the `url` again with a content-focused
     prompt (headings, prose, every code block verbatim) to refresh the
     mapped `references/<file>.md`.
3. Fetch any newly-discovered URLs from Pass A the same way (both passes),
   add them as new `references/NN-slug.md` files, and add entries to
   `sources.json`.
4. Compare fetched content against the existing `references/<file>.md`.
   Rewrite the file only where content actually changed — preserve the
   `Source:` line(s) at the top of each file.
5. If a URL 404s, don't guess a replacement path by pattern-matching a
   sibling filename — that's exactly the mistake `audit_history` records.
   Fetch the nearest real parent page and re-derive the correct link from its
   Pass-A output. n8n's docs serve a consistent app-level 404 page ("Page Not
   Found" + "Suggested Pages", no Cloudflare challenge) — that's a real
   wrong-path signal, not a rate limit.
6. Record anything you still can't resolve in `sources.json`'s `known_gaps`.
7. Update `last_full_refresh` in `sources.json` to today's date, and append a
   short entry to `audit_history` describing what changed.
8. Tell the user what changed (new pages, restructured sections, content
   deltas) — don't silently rewrite everything with no summary.

Known gap on record: OAuth2 credential type example (confirmed absent from
this doc tree, not just unfetched — see `references/10-reference-credentials-files.md`).
Re-check it on every refresh in case n8n publishes it later.

`references/sources.json` also keeps a `lessons_from_past_refresh_mistakes`
list — read it before crawling. In short: never guess a sibling URL by
pattern-matching a filename; always ask WebFetch to list a parent page's
*actual* links verbatim first, and use precise "quote verbatim" prompts (not
generic "summarize" ones) when checking whether something is really missing.

### Re-verifying source-derived findings (separate from the docs crawl above)
Several reference files contain findings read directly from `n8n-io/n8n`
source (or a GitHub PR/package) because docs.n8n.io doesn't cover them at
all — `sources.json`'s `source_code_references.files` and
`non_docs_repos_checked` list every one, each with a "Stability caveat" in
its reference file noting it's confirmed-against-a-commit, not a published
contract. **The docs-crawl steps above never touch these** — re-fetching a
docs.n8n.io page can't detect that an internal n8n function changed shape.
That's what `source_code_references.last_verified` tracks instead, and why
bumping `last_full_refresh` must never be treated as covering this too (a
past request to do exactly that was declined for this reason — see
`sources.json`'s `audit_history` entry for 2026-09-06).

When `source_code_references.last_verified` is stale (or on explicit
request):
1. For each entry in `source_code_references.files`, use `gh` (GitHub CLI —
   `gh api`, `gh search code`, or fetching a raw file URL) to confirm the
   cited path still exists in `n8n-io/n8n` and still does what `used_for`
   says. Note the current commit/date checked. Entries marked "compiled,
   n8n@<version>" were read from the locally installed n8n:
   `scripts/n8n-source.mjs version|grep|show` re-checks them against
   whatever n8n is installed now.
2. Do the same for each `non_docs_repos_checked` entry (e.g. re-check
   `@n8n/eslint-plugin-community-nodes`'s current rule list — it's an
   actively developed plugin, most likely of these to have changed).
   `scripts/check-skill.mjs --package <a node package>` lists installed
   rules missing from `sources.json`'s `rule_snapshot`, with their
   messages. Judge each against reference 19, then update the snapshot.
3. If a finding no longer holds, update the reference file's content
   directly (per the Ground Rule below: state the corrected fact plainly,
   no "correction:" narrative in the reference file itself — that history
   belongs in `sources.json` only) and update or remove its stability
   caveat as appropriate.
4. Update `source_code_references.last_verified` to today's date, and append
   an `audit_history` entry describing what was re-checked and what (if
   anything) changed — same as the docs-crawl job, so this leaves the same
   kind of trail.

For any `sources.json` change, in either job, use `scripts/sources-add.mjs`
(`audit`/`lesson`/`gap` with the text in a file via `@file`, or
`touch <date field>`) rather than editing JSON from the shell. After editing
anything in this skill, run `scripts/check-skill.mjs`.

### Improving this skill
Everything a future build needs goes **in this skill**, never in a
session's or a machine's memory: the skill is the reusable part, and memory
only helps one user on one machine. That covers rules the user states
mid-build (e.g. "action nodes are AI tools", "use the real logo"):
write them here, in SKILL.md or the reference they belong to.
- **Bundle real files.** When a build solves something with a file or a
  command sequence a later build will need again, add it to `templates/`
  (copied into packages) or `scripts/` (run from the skill), not as a code
  block in a reference or a command to retype. References explain *why*
  and point at the file. Hand-retyped config is where repeat mistakes came
  from (the TypeScript 6 tsconfig and the eslint 9.29.0 pin were each
  solved twice).
- **Verify it in a real package, including a run that proves it can fail**
  (a mutated expected value, an unfilled placeholder, a known-bad input).
- Document it in `templates/README.md` or
  `references/25-tooling-and-environment.md`, record it with
  `sources-add.mjs audit`, and run `check-skill.mjs`.
- **Test the skill cold:** a subagent with no conversation context, given
  only a user-style request, building into an empty folder. It reports
  gaps; it doesn't edit the skill. In-session rebuilds leak context and
  miss gaps.

## Job 2: build a node for a third-party API

### Step 1 — gather API facts
Before writing any code, pin down (ask the user or read a supplied
doc/OpenAPI link via WebFetch if given one):
- Service name, base URL, auth scheme (API key header/query/body, basic auth,
  OAuth2, none).
- **The API's surface, then the user's pick.** Map every resource and the
  kinds of request it supports (get one, list or search, list by a related
  record), from the docs plus a short probe of the API (see "Mapping the API"
  below). Show it to the user as a table and let them choose. Don't settle on
  a "handful of operations" before the user has seen the whole surface: the
  MusicBrainz node started with Artist only while the API offers the same
  three requests for 11 entities.
- Whether a **trigger** is needed (webhook support? polling? none — see
  `references/02-choose-node-type.md`), or this is purely request/response
  actions.
- Pagination style and rate limits, if relevant to the chosen operations.
- Whether there's an existing n8n node package to extend, or this is a new
  package (ask for/confirm a target directory).
- **Whether operations need different credential types** (e.g. API key or
  anonymous for reads, OAuth2 for writes). If so, read
  `references/10-reference-credentials-files.md`'s "Nodes that declare more
  than one credential" **now**, and make its design choice (one credential
  per node, an expression-driven `authentication` with a cosmetic duplicate
  credential row, or a static one) with the user up front. It's a confirmed
  editor limitation with no clean answer, and it decides the node's whole
  structure.

#### Mapping the API
- **Uniform APIs get an entity table.** When resources share the same
  request kinds (MusicBrainz: lookup/search/browse for every entity; Discogs:
  get/search per type), build one generic builder driven by a table of
  per-resource facts (path, list key, simplified fields, includes, links).
  A resource is then one row, so covering more costs little.
- **Find the links the docs don't list.** Fetch one record per resource and
  look for fields that point elsewhere: `*_url`, `resource_url`, `uri`,
  `pagination.urls.next`, nested records with IDs, `relations`. Follow each
  once; each is a candidate operation (Discogs `versions_url` -> "Get
  Versions", `releases_url` -> "Get Releases"). Read the docs' tables and
  footnotes too: MusicBrainz's linked-entities table defines browse, and a
  footnote changes how release pages advance (see
  `references/24-reference-pagination.md`).
- **Probe parameter values instead of guessing.** Many APIs name an invalid
  value in a 400 (MusicBrainz: "ratings is not a valid inc parameter for the
  series resource"). A 200 doesn't prove support: MusicBrainz accepts
  `inc=ratings` on areas and returns no ratings. Keep probes few and spaced
  (`references/25-tooling-and-environment.md`, rate limits).
- **Operations should chain.** Every ID-shaped output field (a search hit's
  `id`, a nested `release-group.id`, `master_id`) should be accepted by some
  Get or Get Many input, in the same ID format. Check this before choosing
  the operation list.

Use `AskUserQuestion` for anything genuinely undetermined (auth scheme,
trigger vs action-only, declarative vs programmatic if the API mixes REST and
non-REST calls) rather than guessing silently.

### Step 2 — decide node type and building style
Apply the rules in `references/02-choose-node-type.md` and
`references/03-choose-building-style.md`:
- Default to **declarative** style for a REST API with standard CRUD-ish
  operations. Declarative's `preSend`/`postReceive` hooks
  (`references/21-reference-routing-hooks.md`) handle single-request/response
  transformation — including changing the request body format entirely — so
  "needs data transformation" is **not** on its own a reason to go
  programmatic; don't assume it is.
- Force **programmatic** style only if: it's a trigger node, the API is
  non-REST (e.g. GraphQL) in a way that doesn't fit one request + pre/post
  transform, full versioning is required, or the operation needs genuinely
  multi-step/sequential dependent requests per item.
- If the target API is rate-limited, check
  `references/22-reference-batching.md` before assuming programmatic gives
  better throttling control — declarative gets a free, engine-level batching
  throttle that programmatic does not.

### Step 3 — scaffold the package
`npm create @n8n/node@latest` is n8n's recommended entry point (see
`references/07c-node-cli-tool.md`), but its wizard **needs a real
interactive terminal** (arrow-key prompts fail in Claude Code's shell) and
only scaffolds **one** auth method. If either applies (the usual case from
here), hand-build per `references/05-file-structure.md`.

**Start a hand-built package with `scripts/scaffold.mjs`**, which copies
`templates/` (see `templates/README.md`), fills the `package.json`
placeholders, runs `npm install`, and lists what's left to write
(`--usable-as-tool`, `--paginated` and `--resource-locator` add the optional helpers).
**Never invent the `--author` name** (for example by splitting a username into
a first and last name): it is published in `package.json` and the LICENSE.
Use the name the user gives, otherwise their GitHub handle or
`git config user.name` as written, and tell them which one you used. It holds verified, ready-to-use project files:
`package.json` (fill in the `__placeholders__`), `tsconfig.json`,
`jest.config.js`, `eslint.config.mjs` (it actually lints `package.json`),
`.gitignore`, `scripts/copy-assets.js`, the AI-tool "Output" helper and its
tests (only if `usableAsTool: true`), and the `test/e2e/` HTTP-call-count
check (fill in its `CONFIG`). Copy them; don't retype them from the
references. The references explain *why* each setting is there. Then
`npm install` and write the service-specific files. Layout:
```
<pkg>/
  package.json  tsconfig.json  jest.config.js  eslint.config.mjs  .gitignore   (templates)
  scripts/copy-assets.js                                                       (template)
  nodes/<NodeName>/
    <NodeName>.node.ts
    <NodeName>.node.json
    <nodename>.svg
    actions/output.ts            (template, usableAsTool nodes only)
    actions/pagination.ts        (template, list operations)
    actions/resourceLocator.ts   (template, "pick a record" fields + listSearch)
    __tests__/                   (unit tests for custom hook/method logic)
  credentials/
    <NodeName>Api.credentials.ts
  test/e2e/                      (templates: http-counter.cjs, retry.e2e.cjs)
```
For `<nodename>.svg` and `.dark.svg`, **use the service's real logo**:
`scripts/fetch-icon.mjs --slug <service> --dir nodes/<Name> --name <nodename>`
writes both theme variants from Simple Icons and prints the attribution for
the README (the user's rule: reusing a logo to identify the service in a
personal, non-commercial package is fine). If the brand isn't in Simple
Icons, **don't draw an icon**: ask the user to provide the logo file (SVG,
or a 60x60 PNG), and leave the build otherwise ready. See
`references/04-node-ui-design.md`'s "Icons".
Use `references/07-tutorial-declarative.md` as the literal template for a
declarative node's shape (imports, `INodeTypeDescription` fields, resource/
operation pattern, routing). Use `references/07b-tutorial-programmatic.md` as
the literal template for a programmatic node — it has the confirmed, real
`execute()` implementation (input-item loop, `getNodeParameter`,
`httpRequestWithAuthentication`, `constructExecutionMetaData`,
`continueOnFail` handling). Only fall back to cross-checking a real node in
`n8n-io/n8n`'s `packages/nodes-base` for the one confirmed gap: OAuth2
credentials (see `references/10-reference-credentials-files.md`). Both
templates include `usableAsTool: true`, and **every action node sets it**:
the user's standing rule, which matches the lint rule
`node-usable-as-tool`. Don't ask about it. Scaffold with
`--usable-as-tool`, use the "Output" parameter, and build the AI Agent
fixture (see either template's note on that field). Only a trigger-only
node leaves it out.

**Declarative gotchas that fail silently.** Check every one of these while
writing routing. Each was a real bug in a past build, and none of them
raise an error:
- A resourceLocator never goes in a routing expression.
  `$parameter.<field>` is the raw value: the ID in From List / By ID mode,
  but the **whole pasted URL** in By URL mode, because the mode's
  `extractValue` regex isn't applied there (and `.value` is `undefined`).
  Build the URL in a preSend with `getNodeParameter(name, undefined,
  { extractValue: true })`: `setUrlFromLocator` in
  `templates/nodes/__NodeName__/actions/resourceLocator.ts`
  (`references/11-reference-ui-elements.md`). Its validation regexes are
  tested by n8n as `^…$`: give `urlRegex` only up to the ID and let the
  template append the tail, and run the URL shapes users will paste through
  its tests.
- Credentials need an `icon` too, or lint fails. From `credentials/`, point
  at the node's files: `file:../nodes/<Name>/<name>.svg`
  (`references/10-reference-credentials-files.md`).
- A `qs`/`body` routing expression that resolves to `undefined` is sent as
  the text `"undefined"`. Optional keys go in a `preSend`
  (`references/21-reference-routing-hooks.md`).
- In a hook, `this.getNodeParameter(name, fallback)` has **no item index**.
  `getNodeParameter('x', 0)` means fallback 0 (same file).
- A `listSearch` method gets `filter: undefined` when the picker opens. Guard
  it before calling a search API (`references/11-reference-ui-elements.md`).
- If `usableAsTool: true`, use the "Output" parameter (`output`:
  `simple`/`raw`/`fields`, ID always kept) from
  `templates/nodes/__NodeName__/actions/output.ts`, not a Simplify toggle.
  The rules are in `references/19-reference-ux-guidelines.md`.
- List operations (Get Many, search) get **Return All + Limit**, not a raw
  Offset parameter (`references/24-reference-pagination.md`). n8n's built-in
  `offset`/`generic` pagination sends pages **back to back**, so for a
  rate-limited API use `paginateWithDelay` from
  `templates/nodes/__NodeName__/actions/pagination.ts`.
- For a rate-limited API, input items are still sent **back to back**: the
  engine's Batching option is off by default and a node can't turn it on
  (`references/22-reference-batching.md`). Tell users the values to set in
  a `notice` property under the operation and in the README's Rate limit
  section (Step 6).

### Step 4 — credentials
Follow `references/10-reference-credentials-files.md`. Pick the `authenticate`
shape (`headers` / `qs` / `body` / `auth`) matching the target API, and give
it a `test` request against a real cheap endpoint (e.g. a "whoami"/"me" call).
For programmatic nodes, wrap the actual request call in
`this.helpers.httpRequestWithAuthentication.call(this, '<credentialName>', options)`
so authentication is applied automatically (see `references/07b-tutorial-programmatic.md`).
When it's time to actually test with real credentials, follow
`references/10-reference-credentials-files.md#testing-credentials-safely` —
in particular, use a dedicated/throwaway third-party account rather than a
personal one for any node with write operations, never hardcode a secret
into anything committed, and prefer seeding the local dev n8n instance's
credential store from environment variables via `n8n import:credentials`
(see that section's "Concrete technique") over hand-typing secrets into the
Credentials UI each session.

### Step 4b — error handling and item linking (programmatic/trigger nodes only)
Declarative nodes can skip this. For programmatic nodes, use
`references/08e-reference-error-handling.md` (`NodeApiError` for
upstream/HTTP failures, `NodeOperationError` for validation/param failures,
both support a `failure.cause` hint like `rate-limited`) and
`references/08f-reference-item-linking.md` (set `pairedItem` on every
returned item — `this.helpers.constructExecutionMetaData(...)` does this for
you, don't build it by hand).

Check every parameter that ends up in a URL path before the request. An
expression that resolves to nothing gives the string `undefined`, so the
request goes to `.../call/log/undefined`, and the API's 404 hides the real
mistake. Throw a `NodeOperationError` naming the parameter instead. This was
seen with the Freebox node on 2026-10-25. `Number('')` is `0`, so check for
empty values separately.

### Step 5 — UI and naming conventions
Apply `references/04-node-ui-design.md` (Title Case node/param names,
Resource-then-Operation ordering, optional fields under "Additional Fields",
"Trigger on" naming for trigger selectors, etc.) and pick parameter types from
`references/11-reference-ui-elements.md` (e.g. `resourceLocator` for
"pick a record by ID or from a list" fields, `fixedCollection` for repeatable
grouped inputs). Treat this as a manual review pass, not something the linter
verifies for you — see `references/19-reference-ux-guidelines.md`'s "How much
of this is actually checked by tooling" for exactly which copy/naming rules
have no automated check at all under the current official lint/scan tooling.

### Step 6 — codex + package.json
Fill in `<NodeName>.node.json` per `references/09-reference-codex-files.md`
(pick a real `categories` value from its fixed list). Fill in `package.json`
per the example in `references/07-tutorial-declarative.md`, and if the goal is
eventual community publishing, satisfy the naming rules in
`references/16-submit-community.md` (`n8n-nodes-` prefix,
`n8n-community-node-package` keyword) up front.

Write `README.md` (scaffolded from `templates/PACKAGE_README.md`): its
Credentials, Operations and Rate limit sections are placeholders that
`check-package.mjs` fails on until written. n8n verification requires a
README with usage and authentication details
(`references/18-reference-verification-guidelines.md`), and for a
rate-limited API it's where the Batching and Retry On Fail values go.

### Step 7 — test
If scaffolded via the CLI, `npm run dev` (auto-rebuild, `localhost:5678`) is
the primary loop. Otherwise follow `references/13-run-locally.md`
(`npm run build`, `npm link`, link into `~/.n8n/custom` or the OS-appropriate
path, `n8n start`). Either way, run `references/14-node-linter.md`
(`npm run lint` / `npm run lint:fix`). Actually run these commands rather than
just describing them, when the environment allows it — report lint/build
errors back and fix them. If something breaks, check
`references/20-troubleshooting.md` before improvising a fix. A lint run
that prints `package.json ... File ignored because no matching configuration`
is a config bug, not noise: fix it per `references/14-node-linter.md`. When
an API rejects a request that looks right in the UI, log the fully resolved
request from a temporary `preSend`
(`references/21-reference-routing-hooks.md`, "Seeing the fully resolved
request"). Before finishing, check for leftover `console.` and diagnostic
code: no lint rule catches either.

**`scripts/check-package.mjs <package dir>` runs all of the above in one go**
(build, CommonJS output, assets, lint including the "File ignored" trap,
unit tests, placeholders, `console.`/`DIAGNOSTIC` leftovers). Run it after
each change and report its FAIL/WARN lines. It also prints the exact node
`type` strings for workflow fixtures. To run a fixture through the real
engine, use `scripts/n8n-run.mjs <fixture.json> --count-http <api host>`
(`"auto"` credentials, per-node summary, HTTP calls with timing).

If the node has any custom `preSend`/`postReceive` logic beyond trivial field
mapping (a hand-rolled request body, custom query escaping, response
reshaping), also add unit tests for those specific functions — see
`references/12-test-your-node.md`'s "When to add unit tests beyond these two
methods." This is not a blanket requirement for every node; skip it for a
node built entirely from static `routing` JSON with no custom hook functions.

**Write operations** (create, update, delete, actions) act on the user's real
account. Unit-test each one's request: method, path, body and encoding, with
a recorder in place of the HTTP helper. Live-test only these kinds:
- writes that change nothing, such as setting a value to its current value;
- writes the API refuses, such as a missing permission, which also tests the
  error message;
- writes you undo yourself straight away, after checking that what you're
  removing is the thing you created.

Tell the user what you created and removed. Don't count on the API rejecting
bad input to keep a test harmless. The Freebox accepted a download into a
folder that didn't exist and created a real, failing task (2026-10-25).

Run `npm run test:e2e` (from `templates/test/e2e/`, with its `CONFIG`
filled in). It runs the node through n8n's real engine and asserts the
exact number of HTTP calls with Retry On Fail off and on. Unit tests with a
mocked node interface can't cover this, because retries happen in n8n's
engine above the node.

**Make the fixtures check themselves.** Build them with
`templates/test/fixtures/checks.cjs`, which puts an If plus Stop and Error
pair after each step. Run them with `npm run test:fixtures`, which exits 1
and names the failing step. They import into the n8n editor as ordinary
workflows too. Details: `references/12-test-your-node.md`, "Self-checking
fixtures".

For repeated regression checks across many operations (e.g. after all
resources are built) without re-clicking through the UI each time, see
`references/12-test-your-node.md`'s "Scripting a repeatable end-to-end check"
(`n8n import:workflow` + `n8n execute --id`) — no official e2e framework
exists for community nodes, this composes n8n's own server CLI commands.
Build more than one fixture — see that section's "Which fixture workflows to
build": single item, multiple items in one execution, the node's own trigger
as the workflow start (if it has one), and as an AI Agent tool (if
`usableAsTool: true`) each exercise a different code path.

### Step 8 — deployment (only if asked)
Every package ships `.github/workflows/publish.yml` and a `LICENSE` from the
templates: n8n verifies only versions published from GitHub Actions with
provenance, never a local `npm publish`. Say so before any local publish.
Point to `references/16-submit-community.md` (public/community, required for
n8n Cloud) or `references/17-install-private.md` (self-hosted/private,
typically Docker). If the user wants n8n's official **verification**, the bar
is stricter than a plain community node — walk through
`references/18-reference-verification-guidelines.md` (one service per
package, MIT license, zero runtime dependencies, no env/filesystem access)
and `references/19-reference-ux-guidelines.md` (mandatory OAuth when
available, fixed CRUD naming, password fields for secrets) explicitly rather
than assuming the node already qualifies — a passing `npm run lint`/
`scan-community-package` does **not** mean the UX guidelines are met, see
that file's "How much of this is actually checked by tooling"; walk the UX
checklist manually regardless of lint output. Don't publish or push anything
without explicit confirmation — this is a "hard to reverse, visible to
others" action.

## Ground rule
Treat `references/` as the source of truth for n8n conventions over prior
training knowledge — it was captured directly from docs.n8n.io. If something
needed isn't covered there (see each file's "Known gap" notes), say so
explicitly rather than inventing an API shape, and offer to run Job 1 to try
to fill the gap.

**No ad hoc research mid-build.** While implementing, don't fill a gap in
n8n knowledge with live research (WebFetch of n8n docs, `gh search code`
on `n8n-io/n8n`, browsing GitHub). Use the references, make the best call
they support, flag the uncertainty in a code comment and in the report, and
record the gap with `sources-add.mjs gap` for a deliberate Job 1 pass.
Research only when the user asks for it. Two things are not this kind of
research: Job 1 itself, and Step 1's gathering of the *target API's* facts
from a doc link the user gave or agreed to (for example probing the API
when its docs are blocked, `references/25-tooling-and-environment.md`).
Reading n8n's *installed* source with `scripts/n8n-source.mjs` to check a
runtime claim is also fine: it's local and it's what the Ground rule below
asks for.

**Runtime-behavior claims need a different kind of verification than
authoring-shape claims.** `references/` is built almost entirely from the
`/connect/create-nodes/` tree, which documents how to *author* a node — it
says nothing about what n8n's *engine* actually does with that node at
runtime (retry behavior, throttling, error-hint consumption, etc.). Before
asserting that some runtime behavior forces or enables a design decision
("X isn't supported so you must do Y", "throwing this triggers automatic
retry"), verify it against a docs.n8n.io page outside `/connect/create-nodes/`
(e.g. `references/23-reference-node-runtime-settings.md`'s sources) or
against `n8n-io/n8n` source directly — don't infer runtime behavior from the
authoring docs' code shape. See `references/sources.json`'s
`lessons_from_past_refresh_mistakes` for the incidents that established this.

**Editor-display claims are a third category.** They cover whether a field
or credential row actually renders, and whether it reacts to other
parameters. Neither the docs nor the engine source settles them, since the
editor has its own display logic (e.g. it doesn't evaluate expressions when
deciding visibility). Verify them by opening the node in a real running
editor. `references/10-reference-credentials-files.md`'s multi-credential
section is the precedent.
