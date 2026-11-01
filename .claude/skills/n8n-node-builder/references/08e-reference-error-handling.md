# Reference: error handling

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/error-handling.md

Two error classes, pick based on where the failure originated.

## `NodeApiError` — external API / HTTP failures
Covers: HTTP request failures, external API errors, auth/authorization
failures, rate limiting, service-unavailable errors.
```typescript
new NodeApiError(node: INode, errorResponse: JsonObject, options?: NodeApiErrorOptions)
```
```typescript
try {
  const response = await this.helpers.httpRequestWithAuthentication.call(
    this, credentialType, options
  );
  return response;
} catch (error) {
  if (error.httpCode === '401') {
    throw new NodeApiError(this.getNode(), error as JsonObject, {
      message: 'Authentication failed',
      description: 'Please check your credentials and try again.',
    });
  }
  throw new NodeApiError(this.getNode(), error as JsonObject);
}
```

## `NodeOperationError` — operational/validation/config failures
Not tied to an external service — missing/invalid parameters, bad data
transforms, etc. Combine with `continueOnFail()` so one bad item doesn't
abort the whole execution (this is the same pattern used in
[07b-tutorial-programmatic.md](07b-tutorial-programmatic.md)'s `execute()`):
```typescript
new NodeOperationError(node: INode, error: Error | string | JsonObject, options?: NodeOperationErrorOptions)
```
```typescript
for (let i = 0; i < items.length; i++) {
  try {
    const result = await processItem(items[i]);
    returnData.push(result);
  } catch (error) {
    if (this.continueOnFail()) {
      returnData.push({
        json: { error: error.message },
        pairedItem: { item: i },
      });
      continue;
    }
    throw new NodeOperationError(this.getNode(), error as Error, {
      itemIndex: i,
    });
  }
}
```

## `failure` cause hints (on both error classes)
Lets n8n's UI/retry logic distinguish self-resolving problems from ones that
need user action:
- **Self-resolving**: `rate-limited`, `quota-exhausted`, `temporarily-unavailable`
  — optionally pair with `retryAfterMs` or `resetsAtEpochMs` wait hints.
- **Needs action**: `credential-invalid`, `configuration-invalid`, `node-defect`

```typescript
throw new NodeApiError(this.getNode(), error as JsonObject, {
  failure: { cause: 'rate-limited' },
});
```

## What `failure.cause` actually affects at runtime
For a normal action node, `failure.cause`/`retryAfterMs` is documentary
metadata on the thrown error, not a functional retry trigger — n8n's generic
"Retry On Fail" node setting never reads it. The only runtime consumer today
is the polling-trigger backoff scheduler. See
[23-reference-node-runtime-settings.md](23-reference-node-runtime-settings.md)
for the full picture, including what actually does control retry behavior
for action nodes (a workflow-author-configured setting, not anything the
node's code can set), **and, if the node has `usableAsTool: true`, that
file's section on the separate error/retry path AI-tool invocation uses** —
`description` still surfaces there, but a thrown error fails the whole agent
run rather than becoming something the model can read and retry from.
