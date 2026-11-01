# Overview — creating n8n nodes

Source: https://docs.n8n.io/connect/create-nodes/overview.md

A node is an individual component you compose into workflows. Nodes define when a
workflow runs, fetch/send/process data, define flow control logic, and connect to
external services.

Node creation is a five-stage journey:

1. **Plan your node** — `plan-your-node/*` — choose node type, building style, UI
   design, and file structure before writing code.
2. **Build your node** — `build-your-node/*` — tutorials plus reference docs for
   base files, codex files, credentials files, and UI elements.
3. **Test your node** — `test-your-node/*` — run it locally, then run the linter.
4. **Deploy your node** — `deploy-your-node/*` — submit to the community node
   repository (only path for n8n Cloud) or install privately/self-hosted.

Prerequisites assumed by the docs: comfort with JavaScript/TypeScript, git, npm
packages, and n8n concepts (data structures, item linking).
