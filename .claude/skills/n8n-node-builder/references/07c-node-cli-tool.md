# The `n8n-node` CLI tool (`@n8n/node-cli`)

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/using-the-n8n-node-tool.md

**This is the officially recommended way to start a new node** — prefer it
over manually cloning the starter repo (the tutorials in
[07-tutorial-declarative.md](07-tutorial-declarative.md) and
[07b-tutorial-programmatic.md](07b-tutorial-programmatic.md) predate this tool
and clone `n8n-nodes-starter` by hand; the CLI does the same setup for you and
also wires up linting and the publish workflow).

## Install / bootstrap
```shell
npm create @n8n/node@latest      # scaffold a new package, no global install
# or, for repeated use:
npm install --global @n8n/node-cli
n8n-node --version
```

## Commands
| Command | Purpose |
|---|---|
| `n8n-node new` | Interactive scaffolder: file structure + metadata for a new node |
| `npm run dev` | Runs a local n8n with your node loaded, **auto-rebuilds on change**, served at `localhost:5678` |
| `npm run build` | Compiles TypeScript, copies required assets |
| `npm run lint` (`--fix`) | Runs the node linter, see [14-node-linter.md](14-node-linter.md) |
| `npm run release` | Publishes the package to npm (used together with the GitHub Actions publish workflow, see [16-submit-community.md](16-submit-community.md)) |

## `n8n-node new` interactive prompts
- **Node name** — must be `n8n-nodes-<NAME>` or `@<ORG>/n8n-nodes-<NAME>`.
- **Node type** — "HTTP API" (declarative) or "Other" (programmatic). This is
  the CLI's phrasing for the same choice covered in
  [03-choose-building-style.md](03-choose-building-style.md).
- **Template** — GitHub Issues demo, blank/custom, or a programmatic example.
- **Authentication method** — API Key, Bearer Token, OAuth2, Basic Auth,
  Custom, or None. (Note: this is the CLI offering OAuth2 scaffolding even
  though the *written* credentials-files docs don't cover it — see the
  known gap in [10-reference-credentials-files.md](10-reference-credentials-files.md).
  If you pick OAuth2 here, read the generated credential file's code directly
  as your reference instead of the docs.)

## When the wizard can't be used — hand-build instead
The `new` wizard is only usable in a real interactive terminal. Confirmed
with `@n8n/node-cli` (2026-09-06): passing `NAME` and `--template` as flags
still leaves at least two prompts — "What's the base URL of the API?" (a text
prompt, which piped stdin *can* answer) and "What type of authentication does
your API use?" (an arrow-key select list, which piped stdin *cannot* drive;
it fails with `Detected unsettled top-level await`, exit code 13). Claude
Code's shell is non-interactive, so in practice the wizard can't be run from
there.

The wizard also only scaffolds **one** auth method. A node that needs two
credential types (e.g. an API key for reads plus OAuth2 for writes) doesn't
fit it at all — see
[10-reference-credentials-files.md](10-reference-credentials-files.md#nodes-that-declare-more-than-one-credential).

In either case, hand-build the package per
[05-file-structure.md](05-file-structure.md). That is the expected route, not
a degraded one. The wizard's project files are replaced by the skill's own
**`templates/`** folder (see `templates/README.md`): copy `package.json`,
`tsconfig.json`, `jest.config.js`, `eslint.config.mjs`, `.gitignore` and
`scripts/copy-assets.js` from there. Each covers something the wizard would
have set up:
- `tsconfig.json` / `jest.config.js`: TypeScript 6-compatible settings,
  explained in the next section.
- `eslint.config.mjs`: lints `package.json` too, explained in
  [14-node-linter.md](14-node-linter.md#hand-built-packages-writing-eslintconfigmjs-yourself)
  (the obvious minimal config silently skips every `package.json` rule).
- `build` script plus `scripts/copy-assets.js`: `tsc` alone doesn't copy the
  `.svg`/`.node.json` files into `dist/`.
- The `npm run dev` loop has no template. Use
  [13-run-locally.md](13-run-locally.md) instead.

## Why the template `tsconfig.json` and `jest.config.js` look the way they do
The files are `templates/tsconfig.json` and `templates/jest.config.js`.
Verified 2026-10-17 with TypeScript 6.0.3, ts-jest 29.4, jest 30, n8n-workflow
2.16.0, and loaded by n8n 2.37.10. An earlier MusicBrainz build reached the
same config independently after hitting the same errors. Why each
non-obvious setting is there:
- **`module`/`moduleResolution: "node16"`.** The classic
  `"module": "commonjs"` + `"moduleResolution": "node"` fails under
  TypeScript 6 with a hard error, not a warning:
  `TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0`.
  `node16` still emits **CommonJS**, which n8n needs because it loads nodes
  with `require()`. That holds as long as `package.json` has **no**
  `"type": "module"`. Check that `dist/**/*.node.js` starts with
  `"use strict"; ... exports.` after the first build.
- **`isolatedModules: true`.** Without it, ts-jest prints `TS151002` ("Using
  hybrid module kind (Node16/18/Next) is only supported in isolatedModules")
  once per test file. In return, type-only imports must use `import type` or
  inline `type` modifiers, which n8n code does anyway.
- **`types: ["node", "jest"]`** with `@types/node` and `@types/jest` as
  devDependencies. Tests are excluded from `tsc` but still type-checked by
  ts-jest.
- **`exclude: ["**/__tests__/**"]`** keeps tests out of `dist/`. Keep tests
  in `__tests__` folders under `nodes/` so the `testMatch` above finds them.
- The `.svg`/`.node.json` copy step is still needed. `resolveJsonModule`
  doesn't copy files that are never imported.

## Recommended workflow for this skill's "build a node" job
1. `npm create @n8n/node@latest` → answer the prompts (name, HTTP API vs
   Other, template, auth method) to get a correctly-shaped skeleton. Only
   if the shell is interactive and the node needs a single auth method —
   otherwise hand-build (see the section above).
2. Use `npm run dev` while iterating instead of the manual `npm link` dance in
   [13-run-locally.md](13-run-locally.md) (that manual flow still applies if
   the CLI isn't available/network-reachable).
3. `npm run lint --fix` before considering the node done.
4. `npm run release` only once ready to publish (see
   [16-submit-community.md](16-submit-community.md) for the verification bar).
