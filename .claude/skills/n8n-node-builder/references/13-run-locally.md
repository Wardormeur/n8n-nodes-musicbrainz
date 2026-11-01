# Run your node locally

Source: https://docs.n8n.io/connect/create-nodes/test-your-node/run-your-node-locally.md

**If the project was scaffolded with the `n8n-node` CLI**, prefer
`npm run dev` instead of the manual steps below — it runs n8n with your node
loaded and auto-rebuilds on save, at `localhost:5678`. See
[07c-node-cli-tool.md](07c-node-cli-tool.md). The manual flow below is for
projects not using the CLI.

```shell
npm install n8n -g      # once, globally
npm run build            # in your node package
npm link                 # in your node package
```
Then, inside the n8n custom-nodes directory, link the package in:
```shell
npm link <node-package-name>
```

**Adding a second package on Windows:** `npm link <name>` inside
`~/.n8n/custom` runs an npm install there, which may rewrite the folder's
`node_modules` and the other packages' links (not tested here; avoided).
A directory junction links one package without touching the others and
needs no admin rights:
```shell
cmd //c mklink //J "%USERPROFILE%\.n8n\custom\node_modules\<package>" "<package dir>"
```
From Git Bash, build both paths with `cygpath -w`. Verified 2026-10-20:
`n8n-nodes-discogs` loaded as `CUSTOM.discogs` next to the existing
`n8n-nodes-musicbrainz` link.

## Custom directory location (by OS)
- Windows: `C:\Users\<username>\.n8n\custom`
- Linux: `/home/<username>/.n8n/custom`
- macOS: `/Users/<username>/.n8n/custom`

Or wherever `N8N_CUSTOM_EXTENSIONS` points, if set.

If the `custom` directory doesn't exist yet:
```shell
mkdir custom
cd custom
npm init
```
(`.n8n` is a hidden folder — enable "show hidden files" if browsing manually.)

Finally:
```shell
n8n start
```
Find the node in the editor UI by its **display name**, not its npm package
name.

## An easy-to-skip manual test: opening a "From List" picker before typing
If the node has any `resourceLocator` field in "From List" mode, explicitly
test opening that picker **without typing anything first**, not just typing
a query and checking the results. n8n calls the backing `listSearch` method
with `filter: undefined` the instant the picker opens — a habitual tester
tends to start typing immediately, which skips this state entirely and lets
a bug in the empty-filter case ship unnoticed (real incident: MusicBrainz
node, 2026-09-08 — see
[12-test-your-node.md](12-test-your-node.md#when-to-add-unit-tests-beyond-these-two-methods)
for the bug and its unit-test fix). Treat "open with zero characters typed"
as its own manual test case, separate from "type a query and see results."
