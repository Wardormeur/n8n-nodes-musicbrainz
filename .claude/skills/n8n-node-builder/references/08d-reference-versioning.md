# Reference: node versioning

Source: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/versioning.md

Versioning lets you change a node without breaking workflows already saved
against an older version — existing workflows keep using the version they
were saved with; new workflows always get the latest.

## Light versioning (all node types, declarative and programmatic)
Multiple versions inside a single node file, minimal duplication.
1. `version` becomes an array of every supported version: `version: [1, 2, 3]`.
2. Use `'@version'` inside `displayOptions.show` to scope a property to
   specific versions.
3. Read the running version at execution time via `this.getNode().typeVersion`.

```js
{
	version: [1, 2, 3],
	properties: [
		{
			displayName: 'Resource name',
			displayOptions: { show: { '@version': 2 } },
		},
	],
}
```

## Feature-based versioning (finer-grained than light versioning)
Define named feature flags gated by a version-range condition, instead of
managing per-version duplication of whole fields:
```js
features: {
	useNewApi: { '@version': [{ _cnd: { gte: 2.2 } }] },
	useLegacyAuth: { '@version': [{ _cnd: { lte: 2.1 } }] },
}
```
Supported conditions: `gte`, `lte`, `gt`, `lt`, or an exact version match.
Reference a feature from `displayOptions` via `'@feature'`. At runtime, check
it with `this.isNodeFeatureEnabled('featureName')`.

## Full versioning — **programmatic style only**
> "If you build a node using the declarative style, you can't use full
> versioning."
- The base node file extends `NodeVersionedType`, not `INodeType`.
- That base file holds only metadata, `defaultVersion`, and the list of
  available versions — no actual node logic lives there.
- Each version gets its own directory (`v1/`, `v2/`, ...).
- Reference implementation:
  https://github.com/n8n-io/n8n/tree/master/packages/nodes-base/nodes/Mattermost
