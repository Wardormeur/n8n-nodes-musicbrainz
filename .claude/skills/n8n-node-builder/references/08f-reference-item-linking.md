# Reference: item linking (paired items)

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/item-linking.md

**Only relevant for programmatic-style nodes and triggers** — declarative
nodes don't need to think about this at all.

n8n needs to know which input item produced each output item. If that pairing
is missing, expressions in *downstream* nodes that reference "the item this
came from" can break.

Set `pairedItem` on every item you return:
- If you have an existing item to carry the pairing forward from:
  `"pairedItem": { "item": item.pairedItem, "input": 0 }`
- If you're producing an item fresh at loop index `i`:
  `"pairedItem": { "item": i, "input": 0 }`

`input` is optional and only matters for nodes with multiple inputs — it
records which input branch the item came from.

In practice, `this.helpers.constructExecutionMetaData(...)` (used throughout
[07b-tutorial-programmatic.md](07b-tutorial-programmatic.md)'s `execute()`)
is the standard way to attach this correctly instead of building the
`pairedItem` object by hand.
