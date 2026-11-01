# Troubleshooting node development

Source: https://docs.n8n.io/connect/create-nodes/test-your-node/troubleshooting.md

| Symptom | Fix |
|---|---|
| `Credentials of type '*' aren't known` | The credential class's `name` field must exactly match the string used in the node's `credentials: [{ name: '...' }]` array. |
| "API-Server can not be reached. It's probably down" in the editor | Check that node file/folder/class names match what's registered in `packages/nodes-base/package.json` (for community nodes: your own `package.json` `n8n` block); also check `displayOptions` reference real UI element names. |
| Node icon missing from the Add Node menu | Icon must live in the same directory as the node file; must be PNG or SVG only; the `icon` property must include the `file:` prefix and extension, e.g. `file:friendGrid.svg`. |
| Changed icon still shows the old one | The browser caches node icons. After `npm run build`, force-reload the editor (Ctrl+F5) or clear the site's cache; restart n8n only if that doesn't help. Seen 2026-10-25 when swapping in real logos. |
| Icon looks wrong/cropped | SVG: canvas must be square. PNG: must be exactly 60×60px. |
| Node doesn't show up in Add Node menu at all | It isn't registered in `package.json`'s `n8n` block — see the `package.json` example in [07-tutorial-declarative.md](07-tutorial-declarative.md). |
| Description/property changes don't show up after refresh | Stop n8n (Ctrl+C), rebuild, restart — and re-run `npm link` if using the manual local-testing flow ([13-run-locally.md](13-run-locally.md)). |
| Linter warns about file name casing, only on Windows | Known Windows filesystem limitation — case-only renames don't always register. Not a real bug in your code. |
