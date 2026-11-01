# Reference: codex files (`<Node>.node.json`)

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/codex-files.md

JSON metadata file at the node's root, controlling how n8n's GUI displays and
categorizes the node. Filename must mirror the base file's name
(`MyNode.node.ts` → `MyNode.node.json`).

| Field | Purpose |
|---|---|
| `node` | Identifier — `n8n-nodes-<your-node-name>` for community nodes, `n8n-nodes-base.<name>` for built-ins |
| `nodeVersion` | Should match the version in the main node file, e.g. `"1.0"` |
| `codexVersion` | Current spec version, `"1.0"` |
| `categories` | Controls GUI placement — see fixed list below, exact string match required |
| `resources` | Links used for in-app help (`credentialDocumentation`, `primaryDocumentation`, each `[{ "url": "..." }]`) |

**What n8n reads at load time:** only `categories`, `subcategories`,
`alias` and `resources` (`primaryDocumentation`, `credentialDocumentation`).
`node`, `nodeVersion` and `codexVersion` are never read (n8n-core 2.37.10
`nodes-loader/directory-loader.js`, `getCodex`), so the docs' `n8n-nodes-<name>`
and the built-ins' `<package>.<nodeName>` forms both work. Pick either;
the built-in form is `n8n-nodes-<name>.<nodeName>`. `resources` must be
present: the loader destructures it, and if it's missing the whole codex is
dropped (logged only at debug level), so the node loses its categories.
Packages linked into `~/.n8n/custom` also get a "Custom Nodes" category
added.

## Valid `categories` values
Data & Storage, Finance & Accounting, Marketing & Content, Productivity,
Miscellaneous, Sales, Development, Analytics, Communication, Utility.

## Example
```json
{
	"node": "n8n-nodes-nasapics",
	"nodeVersion": "1.0",
	"codexVersion": "1.0",
	"categories": ["Miscellaneous"],
	"resources": {
		"credentialDocumentation": [{ "url": "" }],
		"primaryDocumentation": [{ "url": "" }]
	}
}
```

Reference implementation:
https://github.com/n8n-io/n8n-nodes-starter/blob/master/nodes/GithubIssues/GithubIssues.node.json
