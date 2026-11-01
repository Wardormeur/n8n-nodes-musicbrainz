# Tooling and working environment

This skill ships two different `scripts` folders. Don't mix them up:
- **`scripts/` at the skill root**: tools for *you, the builder*. They run
  from the skill folder and are never copied into a package.
- **`templates/scripts/`**: files *for the package* (e.g.
  `copy-assets.js`). They're copied into the package's own `scripts/`.

Every tool was tested on 2026-10-17 against `n8n-nodes-musicbrainz`, the
older `.old` copy of it (to prove the checks catch real problems), and a
fresh scaffold. Run each with
`node ~/.claude/skills/n8n-node-builder/scripts/<tool>.mjs`. Each prints
its usage when run with no arguments. Node built-ins only, no install.

## Builder tools (`scripts/`)

| Tool | When | What it replaces |
|---|---|---|
| `scaffold.mjs --dir <target> --name <NodeName> --service <slug> [--owner --author --email --description] [--usable-as-tool] [--paginated] [--resource-locator]` | Step 3, starting a hand-built package | Copying `templates/` and filling placeholders by hand. Runs `npm install`, then lists the service-specific files still to write. A scaffold plus the MusicBrainz service files passed every check with exactly the hand-built file set. |
| `check-package.mjs [<dir>]` | Step 7, after every change | The manual checklist: package.json shape (README.md present), leftover `__placeholders__` and README guidance comments, build, CommonJS output, assets in `dist/`, lint with each finding's file, line and rule (a "File ignored because no matching configuration" warning counts as FAIL), unit tests (flags TS151002), `console.`, `DIAGNOSTIC`/`TEMP` leftovers (FAIL), `TODO` (WARN). Also prints the node's workflow `type` strings (`CUSTOM.x` when linked, `<package>.x` when installed from npm). Exit 1 on FAIL. Caught both real defects in `.old`. |
| `n8n-run.mjs <workflow.json> [--count-http host/prefix] [--headers user-agent,...] [--debug] [--json]` | Running a fixture through the real engine | Hand-run `export:credentials` + `import:workflow` + `execute --rawOutput` + ad hoc parsing. Credentials written as `"auto"` are resolved by type. Parses the execution JSON even when n8n wraps it in log lines or, with `--debug`, ANSI colour codes. Prints per node: items, `executionTime`, error with HTTP code, `pairedItem`. `--count-http` lists real HTTP calls with timing; `--debug` lists one log line per Retry On Fail attempt. `--headers` adds the named request headers per call (e.g. check a credential's User-Agent without exporting it decrypted; not for secret headers). When n8n prints only "No active execution found", prints the stored execution error. `--json` shape is in the script header. Exit 0 only on `status: success`. |
| `fetch-icon.mjs --slug <service> --dir <node dir> --name <file base>` / `--search <text>` | Step 3, the node icon | Hand-drawn placeholder icons. Writes light and dark SVGs from the service's real logo (Simple Icons, pinned release, contrast-checked colours) and prints the README attribution. Verified 2026-10-25: reproduced the Discogs icon exactly; the dark fallback (Medium `#000000` -> white) and light fallback (Advent of Code `#FFFF66` -> `#333333`) both apply. |
| `n8n-source.mjs version` / `grep <pkg> <regex> [--files <substr>]` / `show <pkg> <file> <from> [to]` | Answering "what does the engine actually do", and Job 1 source re-verification | Long `$(cygpath -m "$(npm root -g)")/n8n/node_modules/...` paths. `<pkg>`: `core`, `workflow`, `nodes-base`, `cli`. `version` shows which n8n-core/n8n-workflow the local n8n actually runs. |
| `check-skill.mjs [--package <dir>]` | After editing this skill; with `--package` on a Job 1 refresh or after `npm install` pulls a newer lint plugin | Ad hoc link checks and one-off `node -e` rule listings. Verifies links and `#anchors`, backticked `templates/`/`scripts/`/`references/` paths, `sources.json` files, that every template is listed in `templates/README.md`, that every script parses, and that no file contains a pasted copy of its own beginning. `--package` compares the lint plugin installed in that package with `rule_snapshot` in `sources.json` and prints new rules with their messages (exit 1 if any). It doesn't lint a node: `npm run lint` does, via `check-package.mjs`. |
| `sources-add.mjs audit\|lesson\|gap "<text>"` or `@file.txt`; `touch last_full_refresh\|source_code_references\|templates` | Recording anything in `sources.json` | `node -e` JSON edits with `'"'"'` quoting. `@file.txt` takes the text from a file, so apostrophes, backticks and `$` need no escaping. |

Suggested loop for a build: `scaffold.mjs` → write the node, credential,
codex and icon → `check-package.mjs` until clean → link into n8n
([13-run-locally.md](13-run-locally.md)) → `n8n-run.mjs` on a fixture with
`--count-http` → `npm run test:e2e` → editor checks by hand.

## Working environment pitfalls (Windows + Claude Code's Git Bash)
Each of these cost at least one failed command in a real build session:
- **Don't call `python`.** On this Windows setup it's the Microsoft Store
  stub and **hangs** until the command times out. Use `node`.
- **Bash heredocs and `node -e "..."` break on backticks, `$` and nested
  quotes.** Backticks inside double quotes run as command substitution, so
  replacement text silently becomes empty. Write the code to a file with the
  Write tool and run it, use the Edit tool for edits, and use
  `sources-add.mjs @file` for `sources.json`.
- **`String.replace` expands `` $` ``, `$&` and `$'` in a replacement
  string.** `` $` `` inserts everything before the match, so an edit whose
  new text contains e.g. `` `^…$` `` pastes the start of the file into its
  middle. This corrupted SKILL.md, a reference and the templates README in
  one session (2026-10-20), and links and paths stayed valid. In edit
  scripts, pass a function, `t.replace(a, () => b)`, or use
  `t.split(a).join(b)`. `check-skill.mjs` now flags a file that contains a
  copy of its own beginning.
- **Git Bash rewrites arguments that start with `/`** when it starts a
  Windows program: `node -e "..." /masters/96559` received
  `C:/Program Files/Git/masters/96559`. Prefix the command with
  `MSYS_NO_PATHCONV=1`, or pass full URLs instead of bare paths.
- **API docs behind a bot check:** some services' docs pages answer 403
  with a Cloudflare challenge (Discogs, 2026-10-20) while the API host
  itself doesn't. Don't try to get around the challenge. Probe the API
  directly instead, a few spaced requests to its root and to the planned
  endpoints, and build from the real response shapes and rate-limit
  headers.
- **Probing an API in practice:** a small Node script with `fetch`, written
  with the Write tool, that sleeps between requests and retries a 503 once
  after a few seconds. Print keys and list keys, not whole bodies. Read
  tokens from `.env`, never from the command line. MusicBrainz still
  answered 503 at 2 s spacing after an earlier burst; spread probes out and
  re-run only the unclear ones.
- **Windows paths in scripts:** a `C:\Users\...` path pasted into a
  bash-quoted `require('...')` loses its backslashes. Convert with
  `cygpath -m` (forward slashes). An ESM `import()` of an absolute Windows
  path also needs a `file:///C:/...` URL (`ERR_UNSUPPORTED_ESM_URL_SCHEME`
  otherwise).
- **The session's working directory can't be moved or renamed**
  (`mv`: "Device or resource busy"). To move it aside: `cp -a` to the new
  place, verify with `diff -rq`, then empty the original in place.
- **`n8n` is a `.cmd` shim:** spawn it through a shell with one pre-quoted
  command string. An args array plus `shell: true` triggers Node's DEP0190
  warning. Every n8n CLI command boots n8n (about 5-8 s), so put several
  checks in one fixture rather than many runs (one fixture per shape;
  spacing calls with Wait nodes: see
  [12-test-your-node.md](12-test-your-node.md#which-fixture-workflows-to-build-dont-stop-at-one)).
- **"No active execution found"** from `n8n execute` means the workflow
  failed n8n's pre-run checks, not that n8n broke. `n8n-run.mjs` prints the
  stored cause (e.g. `WorkflowHasIssuesError: The 'X' node has issues: ...`).
- **Existing credentials and their field names:** `n8n-run.mjs` matches
  `"auto"` credentials by *type* only. If a credential of that type was
  saved with different field names, requests go out without auth. Reading
  the fields needs `n8n export:credentials --decrypted`, which prints
  secrets and may be blocked. Prefer creating the test credential from
  environment variables with the field names the credential class defines
  ([10-reference-credentials-files.md](10-reference-credentials-files.md#testing-credentials-safely)).
- **The user's email is for package.json authorship only.** Don't put it in
  a User-Agent or any request to the target API, including one-off `curl`
  checks; use the package's homepage URL as the contact.
- **npm `allow-scripts` warnings** during `npm install` (isolated-vm,
  @parcel/watcher, ...) didn't affect build, lint, test or n8n loading.
  They're safe to ignore for a node package.
- **eslint version:** every `@n8n/eslint-plugin-community-nodes` from 0.31.0
  to 0.35.1 declares the peer `eslint: "9.29.0"` *exactly*. A package.json
  with `eslint: ^9.x` fails a fresh `npm install` with ERESOLVE. The template
  pins `9.29.0`. If a future plugin changes its peer, `npm view
  @n8n/eslint-plugin-community-nodes peerDependencies` shows the new pin.
- **`n8n-workflow` version:** npm's `latest` tag for `n8n-workflow` is stale
  (2.16.0, while `stable` is 2.43.x on 2026-10-17), so `npm install
  n8n-workflow` compiles against old types. At runtime, nodes use the copy
  inside n8n (2.37.4 in n8n 2.37.10, shown by `n8n-source.mjs version`). The
  templates were verified with 2.16.0. Matching the devDependency to the
  target n8n's copy (`npm i -D n8n-workflow@<that version>`) should give more
  accurate types, but that hasn't been tested yet.
- **Rate-limited target APIs during testing:** a burst can leave the API
  returning 503 for several seconds after it ends, and a long session's
  total traffic can trigger throttling on its own. Space live checks about
  1.2 s or more apart, and re-run once after a pause before concluding that
  something broke. After several `n8n-run` runs in a row, 1.5 s Waits
  inside a fixture still drew a 503 from MusicBrainz, while 2.5 s passed
  (cold-build test, 2026-10-20). For a multi-operation fixture, use Waits
  of 2-3 s and pause 30-40 s between runs.
- **Pausing in Claude Code:** a foreground `sleep` is blocked. Use
  `node -e "setTimeout(() => {}, 30000)"`, or run the next step in the
  background.

## Habits that prevented misdiagnoses
- Read the source (`n8n-source.mjs grep`) **before** concluding that an n8n
  feature doesn't work. Twice in one session, "n8n doesn't do X" turned out
  to be the builder's own input or reading error (a wrong `CUSTOM.` type
  prefix; counting runData entries as retry attempts).
- Make every new check **prove it can fail**: run it once against a known
  bad input (a mutated expected count, the `.old` project, a deliberately
  broken anchor) before trusting a PASS.
