# Reference: node-instance runtime settings (Retry On Fail, On Error, etc.)

Sources: https://docs.n8n.io/build/understand-workflows/workflow-components/work-with-nodes
(the "Node settings" section) and
https://docs.n8n.io/integrations/builtin/handle-rate-limits.md.

**These live outside the `/connect/create-nodes/` tree this skill otherwise
crawls** — they're workflow-builder-facing docs, not node-author docs, which
is exactly why this skill's crawl never surfaced them even after the
link-audit fixes recorded elsewhere in `sources.json`. `root` in this file
stays scoped to `/connect/create-nodes/`; these two URLs are tracked as
exceptions (see the `pages` entries added for this file).

## What exists
Every node instance — regardless of declarative/programmatic style, confirmed
via `packages/frontend/editor-ui/src/features/ndv/shared/ndv.utils.ts`'s
`createCommonNodeSettings()`, which generates these fields identically for
every node type except AI-tool/sub-model nodes — has a Settings tab with:
- **Always Output Data**
- **Execute Once**
- **Retry On Fail** (+ Max Tries, capped at 5; Wait Between Tries (ms), capped
  at 5000) — per the docs: "if using this to work around rate limits, set
  Wait Between Tries (ms) to more than the rate limit."
- **On Error**: Stop Workflow / Continue / Continue (using error output)

These are set by the **workflow author**, per node-instance, in the editor
UI — stored on the workflow JSON's node object (`node.retryOnFail`,
`.maxTries`, `.waitBetweenTries`, `.onError`, `.alwaysOutputData`,
`.executeOnce`). **A node's own code/description cannot configure or
override these** — they're entirely outside the node author's control, only
the workflow author's.

Confirmed applying uniformly to both building styles via
`packages/core/src/execution-engine/workflow-execute.ts`'s `getRetryParams()`
(the function that actually drives Retry On Fail): it branches only on
`executionData.node.retryOnFail`/`maxTries`/`waitBetweenTries`, with no check
on node style, `usableAsTool`, declarative `routing`, or programmatic
`execute()`.

### Observed behavior (n8n 2.37.10, live-tested 2026-10-17)
In the installed 2.37.10 build the retry logic is inline in
`WorkflowExecute`'s node loop (`n8n-core/dist/execution-engine/workflow-execute.js`);
there is no separate `getRetryParams()` function in that version. What it
does:
- **Limits:** with Retry On Fail on, `maxTries = min(5, max(2, node.maxTries || 3))`
  and `waitBetweenTries = min(5000, max(0, node.waitBetweenTries || 1000))`.
  So enabling it always means at least 2 attempts, and the default is 3
  attempts 1 s apart.
- **Every error is retried, whatever its HTTP status.** A forced 400 (invalid
  ID, which can never succeed) was attempted 3 times, 1.5 s apart, before
  failing. For a client error, Retry On Fail only wastes requests. It helps
  with transient failures (5xx, timeouts, rate limits) only.
- **Against a rate limit it gives at most about 20 s of patience** (5 tries ×
  5000 ms). A MusicBrainz 503 burst outlasted 3 tries × 2000 ms in a real run.
  For a known rate limit, prevent the problem with the declarative batching
  setting ([22-reference-batching.md](22-reference-batching.md)) and keep
  Retry On Fail as the fallback.

**How to tell whether retries happened.** All attempts run inside **one**
node run, so the execution's `resultData.runData[<node>]` array has **one
entry** however many attempts there were. Counting entries says nothing
about retries; that misled an earlier investigation into "retry didn't
fire". Use either:
- the entry's `executionTime`. A failed Get Many with 3 tries × 2000 ms took
  4284 ms, against about 150 ms for a single attempt; or
- `N8N_LOG_LEVEL=debug`, which logs `Running node "<name>" started` and
  `... finished with error` once **per attempt**, with timestamps.

## `failure.cause` (from `08e-reference-error-handling.md`) does not drive Retry On Fail
`08e-reference-error-handling.md` documents `NodeApiError`/`NodeOperationError`'s
optional `failure: { cause, retryAfterMs, resetsAtEpochMs }` shape. That field
is unrelated to the Retry On Fail setting above — declaring
`cause: 'rate-limited'` does not trigger automatic backoff/retry.

Reading `workflow-execute.ts`'s retry path directly (`getRetryParams()` and
the surrounding retry loop, ~line 1801 and ~2298-2357 in the audited commit)
shows it reads **only** `node.retryOnFail`/`maxTries`/`waitBetweenTries` and
does a plain `setTimeout`/`sleep(waitBetweenTries)` — grep of the whole file
for `failure`, `cause`, `retryAfterMs`, `resetsAtEpochMs` in the retry path
returns no matches.

The **only** current consumer of `failure.cause` in the codebase is
`packages/cli/src/workflows/triggers/poll-backoff-policy.ts` /
`poll-backoff.service.ts` — the **polling-trigger** scheduler, which reads
`cause`/`retryAfterMs`/`resetsAtEpochMs` to compute delay before the next
*scheduled poll* (gated behind a `durableCursorsEnabled` feature flag). This
is a completely different code path from a normal action-node request
failing mid-execution, and only applies if the node in question implements a
`poll()` trigger method — not for ordinary resource/operation actions.

**Practical implication**: for a normal action node, treat `failure.cause` as
informative/documentary metadata on the thrown error (and possibly future
editor-UI messaging — unconfirmed either way), **not** a functional retry
trigger. Actual rate-limit resilience for an action node comes from: telling
users in the node's README to configure Retry On Fail themselves, and/or, if
the node is declarative, the batching hook in
[22-reference-batching.md](22-reference-batching.md).

## Stability caveat on the three findings above
Split by how each was actually confirmed, since they're not all equally
solid:
- **The existence and behavior of Always Output Data / Execute Once / Retry
  On Fail / On Error themselves** is doc-confirmed (the two sources at the
  top of this file) — solid, not just source-derived.
- **The specific claims that `getRetryParams()` branches on nothing but
  `retryOnFail`/`maxTries`/`waitBetweenTries` (no style/`usableAsTool`
  check), and that `createCommonNodeSettings()` generates these fields
  identically across node types**, are read directly from
  `workflow-execute.ts` and `ndv.utils.ts` with no doc or staff corroboration
  — internal implementation shape, could change in a future refactor without
  any doc update to signal it.
- **The poll-backoff-policy.ts `failure.cause` consumer** is the least
  stable of the three: it's gated behind a `durableCursorsEnabled` feature
  flag, which by itself signals evolving/experimental status rather than a
  settled contract — more likely than the other two to change shape or be
  replaced outright.

Treat all three as "confirmed against the commit cited above, not a
published contract" — re-verify against current source rather than assuming
permanence, and re-check on this skill's next refresh.

## AI-tool invocation (`usableAsTool: true`) uses yet another, separate error/retry path
Source-confirmed in `n8n-io/n8n`, commit `e8b8694a5061e926a6db1c8748faea976d93edba`
— a third distinct path, alongside the two above (ordinary action-node retry,
polling-trigger backoff):
- When invoked as an AI Agent tool, the node runs through
  `packages/core/src/execution-engine/node-execution-context/utils/create-node-as-tool.ts`
  and `get-input-connection-data.ts`'s `makeHandleToolInvocation()` — not the
  ordinary action-node execution path `getRetryParams()` governs above.
- That path wraps execution in its own try/catch with its own retry loop
  (`maxTries`/`tryIndex`) — unrelated to both the node-instance "Retry On
  Fail" setting above and the polling-trigger backoff policy. Confirm
  empirically what its `maxTries` actually is (fixed constant vs.
  configurable) before assuming a specific retry count for a given node.
- On final failure it throws a `NodeOperationError` whose `message` has the
  original error's `description` field appended
  (`` `${message}\n\nDetails: ${description}` ``) — so a node's
  `NodeApiError`/`NodeOperationError` `description`
  ([08e-reference-error-handling.md](08e-reference-error-handling.md)) still
  reaches the surfaced failure when tool-invoked, same as the ordinary path;
  nothing extra needed there.
- **What's genuinely different**: the thrown error fails the whole agent
  execution — it is **not** converted into an observation string the model
  could read and retry from with corrected arguments. A node with
  `usableAsTool: true` should not assume the model gets a "soft" failure
  signal it can self-correct from; if that assumption matters to the node's
  design (e.g. whether client-side validation should be more lenient for
  likely-LLM-supplied arguments), confirm this empirically against a real
  AI Agent run rather than assuming either behavior.

**Stability caveat, stronger than the one on
[21-reference-routing-hooks.md](21-reference-routing-hooks.md):** this is
read directly from execution-engine internals
(`node-execution-context/utils/`), not a documented public contract, and
unlike `preSend`/`postReceive` there's no staff forum post or any other
external corroboration backing it — nothing here has been confirmed as
intentional, stable behavior versus an implementation detail that could
change silently in a future n8n version. Treat it as "this is what the code
does today," re-verify against current source before relying on it for a
node under active development, and re-check on this skill's next refresh.

## Verifying runtime claims generally
A claim about n8n **runtime/engine behavior** (what happens when a node runs)
cannot be verified from the `/connect/create-nodes/` tree alone, no matter
how exhaustively it's crawled — that tree is entirely about how to *author* a
node, never about what the engine does with it afterward. Before writing "X
forces/enables Y at runtime" into any reference file, cite either (a) a
docs.n8n.io page outside `/connect/create-nodes/` (workflow-builder-facing
docs, like the two cited here), or (b) direct verification against
`n8n-io/n8n` source — not an inference from the authoring docs' code shape.
See `sources.json`'s `lessons_from_past_refresh_mistakes` for the incidents
that established this.
