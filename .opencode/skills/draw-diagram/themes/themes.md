# Diagram Themes

## Theme Token Structure

Themes set values in `style.tokens`. These keys are recognized:

- `node.default` — fill, stroke, font for most nodes
- `node.accent` — highlighted/important nodes
- `node.external` — out-of-scope or external system nodes
- `node.system` — the main system being diagrammed
- `edge.default` — standard arrows
- `edge.dashed` — dependency/optional relationships
- `edge.message` — synchronous messages (sequence)
- `edge.async` — asynchronous messages

## Available Themes

- `technical` — neutral, dense, developer-focused
- `presentation` — bold, spacious, stakeholder-friendly
- `beautiful` — polished, refined color palette

Set `style.theme` to the theme name. Then apply the token values from the theme file.
