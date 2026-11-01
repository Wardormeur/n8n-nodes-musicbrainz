# Choose a node file structure

Source: https://docs.n8n.io/connect/create-nodes/plan-your-node/choose-node-file-structure.md

## Required files
Every node package needs:
1. **`package.json`** at the project root (standard npm module).
2. A **`nodes/`** directory containing:
   - Base file: `<NodeName>.node.ts` (e.g. `MyNode.node.ts`)
   - Codex file: `<NodeName>.node.json` (must match the base filename)
   - Any supporting files/subdirectories.
3. A **`credentials/`** directory containing `<NodeName>Api.credentials.ts`.

## One node vs many nodes per package
- Single node: one npm package, one node.
- Multiple nodes: give each node its own subdirectory under `nodes/`.

## Modular layout for non-trivial nodes
Split by concern instead of one giant file:
```
nodes/
  MyNode/
    MyNode.node.ts
    MyNode.node.json
    mynode.svg
    actions/
      <resourceName>/
        index.ts               # or <resourceName>.resource.ts
        <operationName>.operation.ts   # exports `description` + `execute`
    methods/                  # dynamic parameter functions (loadOptions etc.)
    transport/                # shared HTTP/request implementation
credentials/
  MyNodeApi.credentials.ts
```
- `actions/<resource>/` — one subdirectory per resource, each operation file
  exports a `description` (UI properties for that operation) and an `execute`
  function.
- `methods/` — functions referenced from `loadOptions`, `listSearch`, etc.
- `transport/` — shared request-building/auth code reused across operations.

## Versioning
Full versioning adds one subdirectory per version plus a base file that
declares the default version — only take this on when the node actually needs
multiple concurrent versions.

Reference implementation to study: n8n's own **Airtable** node.
