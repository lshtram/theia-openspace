# Beautiful Theme

**Use when:** Portfolio pieces, public-facing documentation, polished reports, design reviews, marketing materials.

**Character:** Refined color palette, subtle shadows implied by color depth, elegant proportions.

## Style Block

```json
"style": {
  "theme": "beautiful",
  "tokens": {
    "node.default":   { "stroke": "#0f172a", "fill": "#f0f9ff", "font": "sans-serif" },
    "node.accent":    { "stroke": "#0369a1", "fill": "#bae6fd", "font": "sans-serif" },
    "node.external":  { "stroke": "#475569", "fill": "#f8fafc", "font": "sans-serif" },
    "node.system":    { "stroke": "#0c4a6e", "fill": "#e0f2fe", "font": "sans-serif" },
    "edge.default":   { "stroke": "#0369a1", "dash": "solid" },
    "edge.dashed":    { "stroke": "#7dd3fc", "dash": "dashed" },
    "edge.message":   { "stroke": "#0f172a", "dash": "solid" },
    "edge.async":     { "stroke": "#0369a1", "dash": "dashed" }
  }
}
```

## Layout Density

Normal. Balanced spacing (100px gaps). Nodes sized proportionally to content.

## Sizing

Standard: w=180, h=64. Lean into consistent proportions.

## Accent Usage

Use `node.accent` for 1–3 key nodes only. Use `node.system` for the main subject. Everything else: `node.default`.
