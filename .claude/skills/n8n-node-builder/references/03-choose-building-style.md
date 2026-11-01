# Choose a node building style

Source: https://docs.n8n.io/connect/create-nodes/plan-your-node/choose-a-node-building-style.md

Two styles. **n8n recommends declarative for most cases.**

## Declarative style (default choice)
Use for REST API integrations with standard operations and no need for custom
data transformation. JSON-based `routing` config, no `execute()` method needed.
- Simpler to write, lower risk of bugs.
- More future-proof (n8n can evolve the runtime under a JSON contract).
- Handles requests via the `routing` key inside each operation's definition.

## Programmatic style (required, not just preferred, when...)
- The node is a **trigger node**.
- The API isn't REST-based (e.g. GraphQL).
- You need genuinely multi-step/sequential dependent requests per item, or
  control flow that can't be expressed as one request plus a pre/post
  transform (see the next paragraph — most single-request transformation
  needs don't actually require this).
- You need **full versioning** of the node.

Declarative routing's `preSend`/`postReceive` hooks
([21-reference-routing-hooks.md](21-reference-routing-hooks.md)) run arbitrary
async JS before a request is sent and after a response is received — not just
static JSON — so single-request/response transformation (including changing
the request body format entirely, e.g. JSON→XML, or reshaping response data)
does not by itself require programmatic style.

For a rate-limited target API, check
[22-reference-batching.md](22-reference-batching.md) first: declarative style
gets a free, engine-level request-throttling hook that programmatic nodes
don't get automatically.

Programmatic nodes implement an `execute()` method that reads incoming items and
parameters, builds the request(s) itself, and returns `INodeExecutionData[][]`.
This gives full control but is more boilerplate and more bug-prone than
declarative routing.

## Code shape comparison

Declarative — routing lives inline on the operation:
```ts
routing: {
  request: {
    method: 'POST',
    url: '=/contacts',
  },
}
```

Programmatic — you write the method yourself:
```ts
import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';

export class ExampleNode implements INodeType {
  description: INodeTypeDescription = {
    // node details
    properties: [ /* resources and operations */ ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    // read parameters, call helpers.httpRequest / requestWithAuthentication,
    // shape the result into INodeExecutionData[][], return it
  }
}
```

For the confirmed, full `execute()` contract (with a real worked example, not
a sketch) see [07b-tutorial-programmatic.md](07b-tutorial-programmatic.md).
Related: [08e-reference-error-handling.md](08e-reference-error-handling.md)
and [08f-reference-item-linking.md](08f-reference-item-linking.md) only
matter for programmatic/trigger nodes.

The `n8n-node` CLI (see [07c-node-cli-tool.md](07c-node-cli-tool.md)) calls
this same choice "HTTP API" (declarative) vs "Other" (programmatic) when
scaffolding a new node.
