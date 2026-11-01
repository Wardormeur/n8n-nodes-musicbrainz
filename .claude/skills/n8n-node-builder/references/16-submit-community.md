# Submit to the community node repository

Source: https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes.md

## Naming requirements
- Package name must start with `n8n-nodes-` or `@<scope>/n8n-nodes-`
  (e.g. `n8n-nodes-weather`, `@weatherPlugins/n8n-nodes-weather`).
- `package.json` `keywords` must include `n8n-community-node-package`.
- `package.json` must have a populated `n8n` attribute (see the `package.json`
  example in [07-tutorial-declarative.md](07-tutorial-declarative.md)).

## Before submitting
- Prefer scaffolding via the `npm create @n8n/node` CLI — see
  [07c-node-cli-tool.md](07c-node-cli-tool.md).
- Run `npm run lint` and `npm run dev`.
- Study existing official nodes on GitHub for conventions.

## Publishing to npm
- **New nodes**: scaffolding from `npm create @n8n/node` ships a
  `publish.yml` GitHub Actions workflow already wired up — run
  `npm run release` locally to bump the version, commit, tag, and trigger the
  publish action.
- **Existing nodes**: copy `.github/workflows/publish.yml` from the
  `n8n-nodes-starter` repo, and make sure `@n8n/node-cli` is a devDependency
  at `>=0.23.0`.
- **Hand-built packages (this skill's templates)**: they build with `tsc`,
  not `n8n-node`, so `templates/.github/workflows/publish.yml` runs lint,
  build and test itself, then `npm publish --provenance --access public` on a
  `vX.Y.Z` tag. Release with `npm version patch` and `git push --follow-tags`.
  Scaffold always copies it and `check-package.mjs` fails without it.
- **Trusted Publisher from the CLI** (npm 11.17+, needs the account's 2FA
  code; a bypass-2FA token is refused for account changes):
  `npm trust github <package> --file publish.yml --repo <Owner>/<repo> --allow-publish --yes --otp=<code>`.
  Write `--repo` and `package.json`'s `repository.url` with the GitHub
  owner's exact casing (`gh api user -q .login`): npm warns when they differ
  and provenance compares them. Verified 2026-10-28 up to the 2FA prompt.
- **Publishing from the local machine doesn't count for verification**, with
  any token: it has no provenance. It's fine as a first publish (npm's
  Trusted Publisher setting only exists once the package does), but submit a
  version published by the workflow. Since 2026 npm requires 2FA to publish:
  locally that means `--otp=<code>`, or a granular token with "bypass 2FA"
  (read and write, all packages: a token limited to selected packages can't
  create a new one). A first publish briefly shows only a `0.0.0-stage`
  placeholder version on the registry; the real version appeared a few
  minutes later with no approval needed, and the placeholder stays in the
  version list (observed 2026-10-28; `npm stage` exists for deliberately
  deferred 2FA). Ask the user never to paste a token into the chat;
  have them set it with `npm config set` themselves.
- One-time npm config: either add GitHub Actions as a Trusted Publisher
  (npmjs.com → package settings → Publish access → Trusted Publishers →
  supply repo owner, repo name, workflow filename `publish.yml`), or create a
  Granular Access Token and store it as the `NPM_TOKEN` repo secret.

## Verification (n8n Creator Portal, creators.n8n.io/nodes)
As of **2026-05-01**, verified nodes must be published via GitHub Actions with
provenance — direct local `npm publish` is no longer accepted for
verification. The full, confirmed requirements live in two dedicated
reference pages — read both before submitting, they're stricter than a
plain community node needs to be:
- [18-reference-verification-guidelines.md](18-reference-verification-guidelines.md)
  — one service per package, MIT license, no runtime dependencies, no env/fs
  access, `npx @n8n/scan-community-package` must pass, English-only docs/UI.
- [19-reference-ux-guidelines.md](19-reference-ux-guidelines.md) — password
  fields for secrets, mandatory OAuth support when the API offers it,
  consistent CRUD naming, Resource Locator for single-item selection, a
  "Simplify" toggle on wide responses, resolution-oriented error messages.

Submit/register via the n8n Creator Portal once ready. n8n may decline nodes
that compete directly with their own paid/enterprise offerings.
