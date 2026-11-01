# Test your node — index

Source: https://docs.n8n.io/connect/create-nodes/test-your-node.md

Two methods, use **both** before publishing:
1. Manual — run the node locally in a personal n8n instance. See
   [13-run-locally.md](13-run-locally.md).
2. Automated — the node linter. See [14-node-linter.md](14-node-linter.md).

If something doesn't work, check [20-troubleshooting.md](20-troubleshooting.md)
first — it covers the common failure modes (credential name mismatches,
icon issues, node not showing up, stale UI after edits).

## When to add unit tests beyond these two methods
This is a recommendation for this skill to apply — n8n's own documentation
stops at the two methods above and doesn't call for unit testing. Neither
manual run nor the linter catches bugs in custom pure-function logic a node
might contain: a malformed body-building function or an escaping bug in a
query-string builder passes both cleanly and only breaks against the real
target API.

Add unit tests (whatever test runner the `n8n-node` CLI scaffold wires up, or
one added as a devDependency — this doesn't conflict with
[18-reference-verification-guidelines.md](18-reference-verification-guidelines.md)'s
"zero runtime dependencies" rule, which is about the published package, not
the test/build toolchain) specifically when the node contains:
- A hand-rolled request-body builder for a non-JSON format (XML, form-encoded,
  multipart) — the kind of logic that typically lives in a
  [`preSend`](21-reference-routing-hooks.md) function.
- Custom query-string escaping/construction logic (e.g. a search query
  builder with an "advanced" raw-passthrough mode alongside an
  auto-escaped simple mode).
- A [`postReceive`](21-reference-routing-hooks.md) response-reshaping or
  normalization function doing more than a static `rootProperty`/`sort`/
  `setKeyValue` action.
- **Any `methods.listSearch` or `methods.loadOptions` function that branches
  on its input before making a request** — e.g. a `listSearch` method
  backing a `resourceLocator`'s "From List" mode. Real incident (MusicBrainz
  node, 2026-09-08): n8n calls a `listSearch` method with `filter: undefined`
  on the picker's very first render, before the user types anything — not
  only when the search box is explicitly cleared. A method that passed that
  straight through to build a request (`filter ?? ''`) sent an empty query
  to the target API, which hard-rejected it with a 400 — breaking "From
  List" mode outright, before a single character could be typed. This class
  of bug is invisible to manual testing unless the tester specifically opens
  the picker *without* typing anything first (easy to skip — see
  [13-run-locally.md](13-run-locally.md)'s note on this), and it's cheaply
  unit-testable without a live n8n instance: call the exported function
  directly with `filter: undefined`/`''` and a `this` that throws if
  anything on it is touched (e.g. a `Proxy` whose `get` trap throws), proving
  the function short-circuits before ever reaching for
  `this.helpers`/`this.getCredentials`/etc. — not just that its return value
  looks right, which a mocked-then-discarded API call could also produce.

**Don't treat this as a blanket rule for every node.** A node built entirely
from static `routing` JSON with no custom `preSend`/`postReceive` functions
has no extra pure-function surface to test — manual run + the linter remains
the right, sufficient bar for that case, per n8n's own documented guidance
above. Reach for unit tests only for the custom-logic surface a node actually
has, not by default.

## Testing with real credentials
Manual testing (above) means testing against the real target API with a real
credential — see
[10-reference-credentials-files.md](10-reference-credentials-files.md#testing-credentials-safely)
before doing that for anything beyond a non-secret field: don't hardcode
secrets anywhere committed, use a dedicated/throwaway third-party account
rather than a personal one for any node with write operations, and seed the
local dev instance's credential store from environment variables via
`n8n import:credentials` instead of hand-typing secrets into the Credentials
UI each session (see that section's "Concrete technique").

## Scripting a repeatable end-to-end check
This skill's own recommendation, not part of n8n's documented guidance — n8n
has no official e2e test framework or `n8n-node` CLI subcommand for
community nodes (confirmed: `test-your-node.md` never mentions e2e/automated/
CI testing, and the CLI's commands are only `new`/`dev`/`build`/`lint`/
`release`, see [07c-node-cli-tool.md](07c-node-cli-tool.md)). "Manual" above
means click-driven and non-repeatable; the closest thing to a scriptable e2e
check is composing two of n8n's own server CLI commands (confirmed:
`docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line`):

1. `n8n import:workflow --input=<fixture>.json` — load a saved workflow JSON
   that exercises the node's operation(s) into the local dev instance.
2. `n8n execute --id <ID>` — run that workflow non-interactively.

**Hand-written fixtures are fine when the editor isn't available** (e.g.
no `n8n start` in the session). `scripts/n8n-run.mjs` takes a plain
workflow JSON (`nodes` + `connections`), resolves credentials written as
`"auto"`, and adds an `id`. Get the node `type` from `check-package.mjs`'s
output (see the prefix rule below) and the parameter names from the node's
own description. A cold build on 2026-10-17 ran two hand-written fixtures
this way without problems. A resourceLocator parameter is written as
`{ "__rl": true, "mode": "id", "value": "..." }`. Keep fixtures in the
package under `test/fixtures/`.

**One fixture per shape, several operations per fixture.** "Shape" below
means the four kinds of workflow (single item, multiple items, own trigger,
AI Agent tool). Within one shape, chain every operation and resource locator
mode into a single workflow: each `n8n execute` boots n8n (5-8 s), see
[25-tooling-and-environment.md](25-tooling-and-environment.md).

**Spacing live calls inside a fixture** for a rate-limited API: put a Wait
node between the nodes under test, e.g.
`{ "type": "n8n-nodes-base.wait", "typeVersion": 1.1, "parameters": { "amount": 1.3 } }`
(the unit defaults to seconds in 1.1: calls came about 1.4 s apart,
cold-build test 2026-10-20). Waits shorter than 65 s stay in-process
(`Wait.node.js`: `if (waitValue < 65000)`), so they work under
`n8n execute`. A longer wait parks the execution in the database, which
`n8n execute` doesn't resume.

**When `n8n execute` prints only "No active execution found"**, the
workflow failed n8n's pre-run checks: typically a parameter failed its
validation regex (`WorkflowHasIssuesError`), so no node ran and no HTTP
call was made. The real message is only in the stored execution record.
`scripts/n8n-run.mjs` reads it (read-only, from `~/.n8n/database.sqlite`)
and prints it as the error.

**Where the fixture JSON should come from otherwise: export your own, don't borrow one.**
The first successful manual run (above) already produces a working workflow
in the editor — use n8n's own export/download on that workflow to get your
fixture. This is simpler and lower-risk than reusing someone else's file: it's
unambiguously yours, and it's guaranteed to match the node's actual current
parameter shape. A public repo of workflow fixtures does exist,
`github.com/n8n-io/test-workflows`, but two things make it a poor source to
copy from rather than merely look at: it has no LICENSE file at all
(confirmed via `gh api repos/n8n-io/test-workflows --jq '.license'` →
`null`), so copying a file into a package you publish isn't clearly
permitted; and its `/workflows` directory is flat, numbered files
(`1.json`...`196.json`) with no per-node naming, built around n8n's own
bundled nodes, not a generic template for a custom declarative node.

**If you write or edit a fixture by hand, the node `type` depends on how n8n
loaded the package. The codex file's `node` field doesn't decide it.**
Confirmed on n8n 2.37.10 (2026-10-11, `n8n-core`'s `CustomDirectoryLoader`
sets `packageName = CUSTOM_NODES_PACKAGE_NAME`, which is `'CUSTOM'`):
- Loaded from `~/.n8n/custom` (the `npm link` flow in
  [13-run-locally.md](13-run-locally.md)) → `"type": "CUSTOM.<nodeName>"`,
  e.g. `CUSTOM.musicBrainz`.
- Installed as a community package from npm → `"type": "<package-name>.<nodeName>"`,
  e.g. `n8n-nodes-musicbrainz.musicBrainz`.

The wrong prefix fails with `Unrecognized node type: <type>`. That looks like
the node didn't load, but it did load, under the other name, and the debug
log doesn't list custom-directory nodes either way. An exported fixture
already has the right prefix for that instance. A fixture moved between a
linked dev setup and an npm install needs its `type` strings changed.
`n8n execute` does load `~/.n8n/custom` exactly as `n8n start` does; no
extra environment variable is needed.

`n8n execute --id <ID> --rawOutput` printed the full execution JSON
(`status`, `data.resultData.runData` per node, `pairedItem` per item) and
exited 0 on success, but **only after some log lines**. Parse from the
first line that starts with `{`, not from the start of stdout. A *failed*
workflow exits 1, with the error message as the last non-stack-trace line
(verified 2026-10-25, n8n 2.37.10, a Stop and Error node). Each node's `runData` array has
one entry per node *run*, not per Retry On Fail attempt. To check retries,
use `executionTime` or the debug log, see
[23-reference-node-runtime-settings.md](23-reference-node-runtime-settings.md#observed-behavior-n8n-23710-live-tested-2026-10-17).

For one-off runs of any fixture, `scripts/n8n-run.mjs <fixture.json>`
does the import, credential lookup (`"auto"`), execute and parsing in one
command. See [25-tooling-and-environment.md](25-tooling-and-environment.md).

### Counting real HTTP calls through the engine (template: `templates/test/e2e/`)
Some behavior happens in n8n's engine, above the node, so no unit test with
a mocked node interface can observe it: Retry On Fail attempts, the
declarative batching throttle, per-item fan-out. To assert on it, count the
HTTP calls the real engine makes:
- `templates/test/e2e/http-counter.cjs` is preloaded into the n8n process
  with `NODE_OPTIONS=--require <path>`. It wraps `http.request`/`https.request`
  and appends one JSON line per call (`method`, `host`, `path`) to the file
  named by `E2E_HTTP_LOG`.
- `templates/test/e2e/retry.e2e.cjs` builds a Manual Trigger → node workflow
  from a `CONFIG` block (node type, credential type, API host and path
  prefix, and parameters that always fail with a 4xx). It finds the
  credential ID with `n8n export:credentials`, then imports and executes the
  workflow twice. It asserts **1** call with Retry On Fail off and **3** with
  3 tries, and exits 0 or 1.

Verified 2026-10-17 on n8n 2.37.10 (MusicBrainz node): both scenarios passed
(1 and 3 calls), and a copy expecting 2 failed with exit 1. It asserts on the
HTTP log, not on `n8n execute`'s exit code. Notes:
- A deterministic 4xx (e.g. an invalid ID) makes the count exact; a 5xx or
  rate-limit failure might succeed on a later try and change the count.
- n8n retries every error, so a 4xx still produces `maxTries` calls.
- `n8n` is a `.cmd` shim on Windows: the script runs it through a shell with
  one pre-quoted command string. An args array plus `shell: true` triggers
  Node's DEP0190 warning.
- It makes real calls to the target API (2 + 3 here), spaced out. Keep it out
  of the default `npm test`. The template runs it as `npm run test:e2e`.

**Caveat:** the docs show only the bare `n8n execute --id <ID>` syntax, with
no documented flags, output format or exit code. The exit codes above were
observed on n8n 2.37.10, not promised by n8n. Re-check them after an n8n
upgrade: the fixture runner below depends on them.

### Self-checking fixtures (template: `templates/test/fixtures/`)
A fixture becomes a test when it fails by itself. The user's design
(2026-10-25) was to build the checks out of n8n's own nodes. After each step,
an **If** node tests the step's output. Its false branch goes to a
**Stop and Error** node, which fails the execution with a message naming the
step and the check. So the workflow:
- imports and runs in the n8n editor like any other workflow, and a failure
  shows on the canvas;
- fails `n8n execute` with exit 1, with that message as the last line;
- needs no custom assertion code outside n8n.

- `templates/test/fixtures/checks.cjs` builds these.
  `buildChain({ id, name, nodeType, credentials, steps, file })` chains the
  steps as Start → step → check → step → … Each step runs once
  (`executeOnce`) and outputs even an empty list (`alwaysOutputData`).
  `check.*` gives:
  - `noError()`, `atLeast(n)`, `count(n)`
  - `hasKeys([...])`, `onlyKeys([...])`
  - `neverKey('key')`, for secrets
  - `failsWith('text')`, for an expected error; it sets the step's
    `onError: continueRegularOutput` so the error becomes an item to check
  - `expr(label, js)`, any other check.

  A check is a JS expression over `items`, the step's output as an array of
  JSON. Only the failed checks appear in the message.
- `templates/test/fixtures/run.cjs` is `npm run test:fixtures [file...]`. It
  resolves `"auto"` credentials, then imports and runs each fixture and
  prints PASS/FAIL, exiting 1 on any failure. A server running on the same
  machine blocks it (task runner port 5679), so stop it first.
- **Check shape, not values:** item counts, keys, types and error codes. Live
  data changes.
- **Write fixtures** follow SKILL.md Step 7's rule. Use only no-op writes, for
  example read the current value, set it, then check it's the same. Put them
  in their own file, because whether a refused write passes depends on the
  permissions the user granted.
- Verified 2026-10-25 on n8n 2.37.10 with the Freebox node: 17 read steps
  and a no-op write passed. A fixture expecting a key that doesn't exist
  failed with exit 1 and the message
  `System: Get: expected keys no_such_key; got [...]`, and the steps after it
  didn't run.

This is *scripted repeatability of the same manual e2e path* above (real
engine, real HTTP call, real target API) — not a substitute for running it
at least once by hand first, and not the same thing as n8n's own internal
`nodes-base` test pattern (real workflow fixtures executed in-process with
HTTP mocked via `nock`), which is monorepo-internal tooling, not published or
documented for third-party node authors to import.

### Which fixture workflows to build (don't stop at one)
A single "Manual Trigger → node" fixture only covers the plainest path. Build
one fixture per shape the node can actually be used in — skip whichever don't
apply to the node being built:

1. **Single item, one operation** — the baseline: Manual Trigger → the node
   with one resource/operation configured. This is what the first successful
   manual run (above) already produces; always applicable.
   **Chaining operations in one fixture:** a list operation (Search, Get
   Many) outputs one item per record, and every later node then runs once
   per item: one request each. On a node that should run once after a list
   node, set the node setting `"executeOnce": true` (at node level, next to
   `parameters`), or put the list node last.

   **Checking the credential is applied** without exporting it decrypted:
   `n8n-run.mjs --count-http <host> --headers user-agent` prints the header
   on each call. Don't log secret headers this way.

2. **Multiple items in one execution** — a node upstream that emits several
   items (e.g. a `Set`/`Code`/`Split Out` node producing an array) feeding
   into the node under test. A single-item fixture cannot exercise per-item
   correctness at all: whether `pairedItem` linkage
   ([08f-reference-item-linking.md](08f-reference-item-linking.md)) is
   correct across multiple output items, and — for a declarative node with a
   [batching](22-reference-batching.md) throttle — whether requests are
   actually paced across more than one call, not just theoretically
   configured. Applicable to any node that takes main input (i.e. skip only
   for a trigger-only node with no input).
3. **The node's own trigger as the workflow's start** — only if the node
   ships a trigger. Confirms the node behaves correctly as the actual
   execution entry point (an active workflow reacting to a real event/poll),
   not just as an action invoked downstream of a Manual Trigger — a
   meaningfully different code path. Skip entirely for an action-only node
   with no trigger.
4. **Invoked as an AI Agent tool** — needs a chat-model credential (an
   LLM API key) in the local n8n, besides the node's own. Without one this
   fixture can't run; say so in the report instead of skipping it
   silently. Only if the node sets
   `usableAsTool: true` (confirmed field, see
   [08-reference-base-files.md](08-reference-base-files.md) and both
   tutorials' templates — this is opt-in, not automatic). Build a workflow
   with an AI Agent node (`n8n-nodes-langchain.agent`), the node under test
   attached as one of its Tools, and a prompt that should cause the model to
   actually call it. This exercises a different parameter-resolution path
   than the other three fixtures — arguments can be filled by `$fromAI()` at
   runtime rather than statically configured — so a fixture that only tests
   the node's normal (non-tool) parameter UI doesn't cover it. Exact
   eligibility/restrictions for which node shapes work well as tools weren't
   found documented on docs.n8n.io as of this check (pages searched 404'd or
   didn't cover it) — if the node has an unusual shape (multiple outputs,
   binary data, no `main` input), verify tool behavior empirically rather
   than assuming it works like the ordinary-node case.

Export each as its own fixture file per the technique above (build it once
manually, download the working workflow) — don't try to cram multiple shapes
into one workflow JSON.
