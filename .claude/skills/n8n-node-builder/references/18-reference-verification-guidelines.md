# Reference: technical guidelines for verified community nodes

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines.md

Applies when submitting to n8n's verification process (see
[16-submit-community.md](16-submit-community.md)) — these are **stricter**
than "just publish a working community node."

## What a verified node package may cover
- Exactly **one** third-party service per package (trigger nodes for that
  same service are fine within the package; a multi-service package or a
  proxy layer does not qualify).
- Must not duplicate an existing (community or built-in) node — contribute a
  PR to the existing one instead of shipping a competing package.
- Logic/flow-control nodes are not currently accepted for verification.

## Package/repo hygiene
- npm package's repository URL must match the actual GitHub repo.
- Author/maintainer identity must be consistent between npm and GitHub.
- Repository must be public with a working git link.
- License **must be MIT**.
- Must publish via a GitHub Action with a provenance statement (mandatory
  from 2026-05-01 — see [16-submit-community.md](16-submit-community.md)).

## Code constraints
- **No external runtime dependencies** — keep the package lightweight and
  self-contained.
- **Must not** touch environment variables or read/write the filesystem —
  all configuration must flow through node parameters/credentials instead.
- TypeScript required.
- Must pass linting via `npx @n8n/scan-community-package n8n-nodes-PACKAGE`
  (a separate, stricter check than the local `npm run lint` — see
  [14-node-linter.md](14-node-linter.md)).
- Proper error handling and input validation (see
  [08e-reference-error-handling.md](08e-reference-error-handling.md)).

## Documentation
- README with usage examples, listed workflows, and authentication details.
- **Everything in English** — node interface text and all documentation,
  including parameter names, descriptions, help text, and error messages.

Also required: meet the [19-reference-ux-guidelines.md](19-reference-ux-guidelines.md)
UX bar, which is stricter/more specific than the general
[04-node-ui-design.md](04-node-ui-design.md) guidance.
