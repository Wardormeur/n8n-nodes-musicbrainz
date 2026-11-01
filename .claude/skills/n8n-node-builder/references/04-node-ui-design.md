# Node UI design and UX principles

Source: https://docs.n8n.io/connect/create-nodes/plan-your-node/node-ui-design.md

This is the general UI/UX guidance for any node. If the goal is
**n8n-verified** status specifically, the bar is stricter — see
[19-reference-ux-guidelines.md](19-reference-ux-guidelines.md) (mandatory
OAuth when available, password fields for secrets, fixed CRUD naming, a
"Simplify" toggle past ~10 response fields, resolution-oriented errors).

Start from the target API's docs and ask: what can be omitted, what can be
simplified, which parts would confuse users? Wireframe complex UIs; use
progressive disclosure (show/hide fields).

## Text style
| Element | Case |
|---|---|
| Drop-down values | Title Case |
| Node names | Title Case |
| Parameter names | Title Case |
| Subtitles | Title Case |
| Hints | Sentence case |
| Tooltips | Sentence case (no period for single sentence, period for multiple) |
| Info boxes | Sentence case (same period rule) |

## Terminology
- Match the connected service's own terminology (e.g. use Notion's words for Notion).
- Prefer GUI language over raw API field names when they differ.
- Avoid jargon; pick the simpler word.
- Be consistent in how the same concept is named across the node.

## Node naming
- Trigger nodes: `"Shopify Trigger"` — not `"ShopifyTrigger"` or `"Shopify trigger"`.
- Never include the word "Node": `"Asana"`, not `"Asana Node"`.

## Field ordering and disclosure
- Show resource, operation, and required fields immediately.
- Hide optional fields inside a collapsible **"Additional Fields"** / **"Options"**
  collection.
- Hide fields that depend on another field's value until the prerequisite is set.
- **Credentials** are auto-positioned at the top by n8n — don't add them manually.
- **Resource** is the first field, **Operation** is the second.
- Required fields: most-important-first, broad-to-narrow scope.
- Optional fields: alphabetical order; rename to group related ones (e.g.
  "Email (primary)" / "Email (secondary)"); bundle dependent fields together;
  pre-fill sensible defaults and explain them in the description.

## Help elements (5 kinds)
1. Info boxes (yellow) — essential info.
2. Parameter hints — small text under a field.
3. Node hints — shown in input/output/details panels; can be conditional via
   `displayCondition` and timed via `beforeExecution` / `afterExecution` / `always`.
4. Tooltips — hover-triggered extra context.
5. Placeholder text — shows expected input shape.

## Errors
Make required fields obvious, validate inputs, show the main error in a red
title with details below.

## Toggles vs dropdowns
- Toggle tooltips start with "Whether to...".
- If the "false" state isn't self-explanatory, use a dropdown instead of a toggle.

## Lists
- Default to the most commonly used option.
- Sort alphabetically.
- Use "All", not abbreviations.
- Only add descriptions to options when they add real value.

## Recurring patterns
- **Simplify Response** toggle — name it exactly that, description: "Whether to
  return a simplified version of the response instead of the raw data".
- **Upsert** — a separate operation named "Create or Update", description:
  "Create a new record, or update the current one if it already exists (upsert)".
- **Boolean combinators** — expose "match all" (AND) and "match any" (OR) as
  distinct options, don't conflate them.
- **Binary/file fields** — name it "Input Data Field Name", not "binary property".
- **IDs** — offer both a pre-populated list (resourceLocator "List" mode) and
  manual ID entry; label like "Workspace Name or ID"; accept flexible input
  (absolute paths, full URLs) where the API allows it.
- **Trigger node's polling/event selector** — name the parameter **"Trigger on"**,
  no tooltip.
- **Subtitles** — generate dynamically from the resource/operation via an
  expression, e.g. `={{$parameter["operation"] + ": " + $parameter["resource"]}}`.
- **Dates/timestamps** — accept any ISO 8601 format.
- **JSON fields** — support both direct typing and expressions.

## Icons
SVG preferred (PNG accepted, 60×60px, square/near-square). Embed Font Awesome
icon markup directly rather than referencing it externally.

Ship a light and a dark variant: `icon: { light: 'file:<name>.svg', dark:
'file:<name>.dark.svg' }` on the node (field table in
[08-reference-base-files.md](08-reference-base-files.md)). A single
`'file:<name>.svg'` string gets the lint warning
`icon-prefer-themed-variants`. The credential needs an icon as well, see
[10-reference-credentials-files.md](10-reference-credentials-files.md#credential-icon).

**Use the service's real logo.** The user's rule (2026-10-25): reusing a
service's logo to identify it in a personal, non-commercial package is fine,
so don't default to a placeholder. Get it with
`scripts/fetch-icon.mjs --slug <service> --dir nodes/<Name> --name <nodename>`:
- It takes the logo from Simple Icons (simpleicons.org), pinned to a
  release: one clean SVG path per brand, with the brand colour and the URL
  the logo came from (e.g. Discogs: `#333333`, https://www.discogs.com/brand).
  `--search <text>` finds the slug.
- It writes `<nodename>.svg` in the brand colour (dark grey if the brand
  colour is too light to read on white) and `<nodename>.dark.svg` (white if
  the brand colour is too dark for n8n's dark canvas), and prints a README
  line with the version, colour and source. Put that line in the README's
  Icon section.
- If the brand isn't in Simple Icons (some brands asked to be removed),
  **don't draw an icon**, not even a labelled placeholder (the user's rule,
  2026-10-25: "Do not draw. Ask the user to provide"). Ask the user for the
  logo: an SVG (preferred) or a 60x60 PNG, plus a dark-theme variant if they
  have one. Put it in the node folder as `<nodename>.svg` /
  `<nodename>.dark.svg`, and say where it came from in the README.
- Next source, when the user agrees (Freebox, 2026-10-25: "If you can't find
  the icon, try the one from Wikipedia"): the logo file on the service's
  Wikipedia article, from Wikimedia Commons. Query
  `https://commons.wikimedia.org/w/api.php?action=query&titles=File:<name>&prop=imageinfo&iiprop=url|size|extmetadata&format=json`
  for the URL and licence. Take the **official** logo the article uses, not
  a Commons search hit: fan-made "logograms" exist (Freebox had one, CC BY-SA,
  wrong capitalisation). Use the SVG paths unchanged; only a wide wordmark's
  viewBox is made square (pad top and bottom) so n8n doesn't stretch it.
  Check it has no script, href or embedded image. Credit file, URL and
  licence in the README Icon section.
- Before **publishing** the package (npm, n8n verification, anything
  commercial), check the service's brand guidelines: the logo is its
  trademark even when Simple Icons ships it.
