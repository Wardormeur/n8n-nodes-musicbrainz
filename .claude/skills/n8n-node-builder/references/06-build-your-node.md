# Build your node — index

Sources:
https://docs.n8n.io/connect/create-nodes/build-your-node.md,
https://docs.n8n.io/connect/create-nodes/build-your-node/reference.md

- Tool: [07c-node-cli-tool.md](07c-node-cli-tool.md) — the official
  `n8n-node` CLI, the recommended way to start (`npm create @n8n/node@latest`).
- Tutorial: [07-tutorial-declarative.md](07-tutorial-declarative.md) — full
  walkthrough building a declarative-style node against NASA's API.
- Tutorial: [07b-tutorial-programmatic.md](07b-tutorial-programmatic.md) — full
  walkthrough building a programmatic-style node against SendGrid's API,
  including the real `execute()` implementation.
- Reference: [05-file-structure.md](05-file-structure.md) — file/folder layout.
- Reference: [08-reference-base-files.md](08-reference-base-files.md) — the
  `<Node>.node.ts` base file (standard params + style-specific params).
- Reference: [08d-reference-versioning.md](08d-reference-versioning.md) —
  light, feature-based, and full versioning.
- Reference: [08e-reference-error-handling.md](08e-reference-error-handling.md)
  — `NodeApiError` / `NodeOperationError`.
- Reference: [08f-reference-item-linking.md](08f-reference-item-linking.md) —
  `pairedItem`, programmatic/trigger nodes only.
- Reference: [09-reference-codex-files.md](09-reference-codex-files.md) — the
  `<Node>.node.json` metadata file.
- Reference: [10-reference-credentials-files.md](10-reference-credentials-files.md)
  — the `<Node>Api.credentials.ts` file.
- Reference: [11-reference-ui-elements.md](11-reference-ui-elements.md) — every
  parameter/UI element type.
- Reference: [18-reference-verification-guidelines.md](18-reference-verification-guidelines.md)
  and [19-reference-ux-guidelines.md](19-reference-ux-guidelines.md) — the
  stricter bar for n8n-verified community nodes.
