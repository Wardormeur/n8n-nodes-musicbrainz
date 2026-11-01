# Node linter

Source: https://docs.n8n.io/connect/create-nodes/test-your-node/node-linter.md

`@n8n/eslint-plugin-community-nodes` statically checks node/credential files
and auto-fixes what it can.

## Setup
`npm install` in the project pulls it in as a dependency (already wired up by
the n8n node starter / `npm create @n8n/node` scaffold). VS Code: install the
ESLint extension. **Don't hand-edit `eslint.config.mjs`** — it's managed by
`@n8n/node-cli`.

### Hand-built packages: writing `eslint.config.mjs` yourself
Without the CLI scaffold (see
[07c-node-cli-tool.md](07c-node-cli-tool.md#when-the-wizard-cant-be-used--hand-build-instead))
there's no config. **Copy `templates/eslint.config.mjs`.** It was verified
with @n8n/eslint-plugin-community-nodes 0.31.0 and 0.35.0. devDependencies:
`eslint`, `typescript-eslint`, `@n8n/eslint-plugin-community-nodes` (the
versions are in `templates/package.json`, which also has the script
`"lint": "eslint nodes credentials package.json"`). How it's built, in case
it needs adapting: the plugin exports a named `n8nCommunityNodesPlugin`;
`configs.recommended` is a **single flat-config object** (don't spread it);
`package.json` is added to `files` with `tseslint.parser`; and
typescript-eslint's own recommended rules are limited to `**/*.ts`.

**The obvious shorter config silently skips every `package.json` rule.**
With only `{ files: ['**/*.ts'] }`, ESLint prints
`package.json  0:0 warning  File ignored because no matching configuration was supplied`
and exits 0. The plugin's package-level rules (`valid-author`,
`require-homepage`, `no-runtime-dependencies`, `require-files-array`,
`package-name-convention`, ...) then never run. They choose their input by
`context.filename.endsWith('package.json')`, so the config has to send
`package.json` to them, with a parser that accepts it. Confirmed 2026-10-11:
switching to the config above immediately reported a real
`valid-author` error ("author field must include a non-empty email") that
the short config had hidden. **Treat that "File ignored" warning as a
config bug, not noise.**

`configs.recommendedWithoutN8nCloudSupport` also exists (40 rules instead of
42). Use it only if the package will never be offered on n8n Cloud.

## Running it
- `npm run lint` — report issues.
- `npm run lint:fix` — report and auto-fix what's fixable.
- Runs automatically before `npm publish` for community packages, in CI via
  GitHub Actions for the main n8n repo, and live in VS Code.
- Lints `*.node.ts`, `*.credentials.ts`, and `package.json` (the last one
  only if the config actually matches it — see above).
- For what the rules do and don't cover, see
  [19-reference-ux-guidelines.md](19-reference-ux-guidelines.md#how-much-of-this-is-actually-checked-by-tooling--treat-this-as-a-manual-checklist).

## Suppressing a rule deliberately
VS Code: hover the diagnostic → "Quick Fix" (Cmd+.) → disable that rule for
the line. Or add a standard ESLint disable comment directly in code.
