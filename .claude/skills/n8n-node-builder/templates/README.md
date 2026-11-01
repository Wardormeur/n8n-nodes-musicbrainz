# Templates for a hand-built n8n community node package

Copy these into a new package instead of retyping them from the references.
Every file here was taken from a working build (`n8n-nodes-musicbrainz`,
2026-10-17) and checked there: TypeScript 6.0.3, n8n-workflow 2.16.0,
@n8n/eslint-plugin-community-nodes 0.35.0, jest 30 / ts-jest 29, loaded and
executed by n8n 2.37.10.

Placeholders are written `__likeThis__`. Replace all of them;
`grep -rn "__[A-Za-z]" .` should find nothing afterwards except the
`__tests__` folders.

| File | Copy to | Edit | Why it exists |
|---|---|---|---|
| `package.json` | package root | every `__placeholder__`; drop `test:e2e` if you skip the e2e check | Scripts (build with asset copy, lint including `package.json`, test, test:e2e), `n8n` registration block, verified devDependency versions. See `references/07-tutorial-declarative.md` and `references/16-submit-community.md` for the naming rules. |
| `PACKAGE_README.md` | package root, as `README.md` | the Credentials, Operations and Rate limit placeholders, and delete the guidance comments (`check-package.mjs` fails on both) | The package README: install, credentials, operations, rate-limit advice (Batching values, Retry On Fail), development commands. The skill's own docs live in this folder's `README.md`, hence the different name. |
| `tsconfig.json` | package root | nothing | `node16` module settings that TypeScript 6 accepts and that still emit CommonJS, plus `isolatedModules` for ts-jest. Reasons: `references/07c-node-cli-tool.md`. |
| `jest.config.js` | package root | nothing | ts-jest; finds `**/__tests__/**/*.test.ts`. |
| `eslint.config.mjs` | package root | nothing | Actually lints `package.json` (the short config silently skips those rules). Reasons: `references/14-node-linter.md`. |
| `LICENSE` | package root | `__Year__` and `__Author Name__` (scaffold fills both from `--author`; never invent the name) | MIT, which n8n verification requires; `check-package.mjs` fails without it. |
| `.github/workflows/publish.yml` | `.github/workflows/` | nothing | **Always included.** Publishes to npm with a provenance statement when a `vX.Y.Z` tag is pushed (`npm version patch`, then `git push --follow-tags`): since 2026-05-01 n8n verifies only packages published from GitHub Actions with provenance. Runs lint, build and test first, and fails if the tag doesn't match `package.json`. One-time setup on npmjs.com: the package's Trusted Publisher (GitHub Actions, this repo, `publish.yml`), or an `NPM_TOKEN` secret. `check-package.mjs` fails without it. Rules: `references/16-submit-community.md`. |
| `.gitignore` | package root | nothing | `node_modules/`, `dist/`, `.env` (test secrets for `seed-credential.cjs`). |
| `scripts/seed-credential.cjs` | `scripts/` | the `CONFIG` block (credential type, display name, ID, field -> environment variable) | Imports a test credential into the local n8n from `.env` or the environment with `n8n import:credentials`, through a temp file it deletes; the secret never appears in a committed file, the command line or the output. Refuses to run while `CONFIG` has placeholders, and `check-package.mjs` fails on them. Technique: `references/10-reference-credentials-files.md`. |
| `scripts/copy-assets.js` | `scripts/` | nothing | `tsc` doesn't copy `.svg`/`.png`/`.json`; this copies them from `nodes/` into `dist/nodes/`, skipping `__tests__`. |
| `nodes/__NodeName__/actions/output.ts` | `nodes/<NodeName>/actions/` | nothing | **Only for `usableAsTool: true` nodes.** The "Output" parameter (Simplified / Raw / Selected Fields, ID always kept) plus `outputSingle`/`outputList` postReceive hooks. Pass each operation its own `show`, field options and simplified-field list. If the operation has an Include-style option, pass `{ parameter, responseKeys }` as the last argument of `outputSingle`/`outputList`, or Simplified mode drops the included data. Rules: `references/19-reference-ux-guidelines.md`. |
| `nodes/__NodeName__/__tests__/output.test.ts` | `nodes/<NodeName>/__tests__/` | nothing | Unit tests for the helper above (10 tests). |
| `nodes/__NodeName__/actions/pagination.ts` | `nodes/<NodeName>/actions/` | `PAGE_SIZE` (API's max per request), `PAGE_DELAY_MS` (from its rate limit); `limit`/`offset` names if the API differs | **For list operations on a limit/offset API.** `buildReturnAllProperties(show, paging?)` gives the Return All + Limit pair; `paginateWithDelay()` goes in the operation's `routing.operations.pagination` and pauses between pages, which n8n's built-in pagination doesn't. Rules: `references/24-reference-pagination.md`. Page-number APIs (`per_page` + `page`, e.g. Discogs) pass `{ style: 'page', limitParameter: 'per_page' }` to both functions. APIs that can return a short page before the end (MusicBrainz release browse) pass `{ untilEmpty: true }` to `paginateWithDelay`. |
| `nodes/__NodeName__/__tests__/pagination.test.ts` | `nodes/<NodeName>/__tests__/` | nothing | Unit tests for the helper above (10 tests). |
| `nodes/__NodeName__/actions/resourceLocator.ts` | `nodes/<NodeName>/actions/` | nothing | **For "pick a record" fields** (`scaffold.mjs --resource-locator`). `buildResourceLocator` (From List / By ID / By URL modes with validation and `extractValue`; you pass the service's URL pattern up to the ID, it appends `urlTail` for n8n's anchored validation), `setUrlFromLocator` (preSend: a routing expression would get the whole URL in By URL mode), `createListSearch` (the `methods.listSearch` function with the empty-filter guard and paging by offset or, with `paging: 'page'`, page number). Rules: `references/11-reference-ui-elements.md`. |
| `nodes/__NodeName__/__tests__/resourceLocator.test.ts` | `nodes/<NodeName>/__tests__/` | nothing | Unit tests for the helper above (21 tests). They validate the regexes the way n8n does (`^…$`) against real URL shapes; add your service's URL shapes the same way. |
| `test/e2e/http-counter.cjs` | `test/e2e/` | nothing | Preloaded into `n8n execute` via `NODE_OPTIONS=--require`; logs every real http/https call. |
| `test/e2e/retry.e2e.cjs` | `test/e2e/` | the `CONFIG` block only | Runs the node through n8n's real engine and asserts the HTTP call count with Retry On Fail off (1) and on with 3 tries (3). Refuses to run while `CONFIG` holds placeholders. Technique: `references/12-test-your-node.md`. |
| `test/fixtures/checks.cjs` | `test/fixtures/` | nothing | `buildChain()` writes a fixture workflow that checks itself. After each step it adds an If node testing the step's output and a Stop and Error node that fails the run with a message naming the step and the failed check. `check.*` gives noError, atLeast, count, hasKeys, onlyKeys, neverKey (secrets), failsWith (expected errors) and expr. You write `test/fixtures/build.cjs` with it; the header has an example. |
| `test/fixtures/run.cjs` | `test/fixtures/` | nothing | `npm run test:fixtures [file...]`: imports each fixture JSON into the local n8n (resolving `"auto"` credentials), runs it with `n8n execute` and prints PASS/FAIL with the Stop and Error message; exits 1 on any failure or when there are no fixtures. Needs no n8n server running. Technique: `references/12-test-your-node.md`. |

Not templated, on purpose: the node file, credential, codex and icon. They're
specific to each service, and their shape is in
`references/07-tutorial-declarative.md`, `references/10-reference-credentials-files.md`
and `references/09-reference-codex-files.md`.

When updating a template, re-verify it in a real package (build, lint, test,
and `npm run test:e2e` for the e2e files) and update the versions above.
