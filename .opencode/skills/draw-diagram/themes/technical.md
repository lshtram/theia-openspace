# Technical Theme

**Use when:** Architecture documentation, code review diagrams, developer wikis, internal tooling docs.

**Character:** Neutral colors, thin strokes, compact spacing, maximum information density.

## Style Block

```json
"style": {
  "theme": "technical",
  "tokens": {
    "node.default":   { "stroke": "#374151", "fill": "#f9fafb", "font": "monospace" },
    "node.accent":    { "stroke": "#1d4ed8", "fill": "#dbeafe", "font": "monospace" },
    "node.external":  { "stroke": "#9ca3af", "fill": "#f3f4f6", "font": "monospace" },
    "node.system":    { "stroke": "#1e40af", "fill": "#eff6ff", "font": "monospace" },
    "edge.default":   { "stroke": "#6b7280", "dash": "solid" },
    "edge.dashed":    { "stroke": "#9ca3af", "dash": "dashed" },
    "edge.message":   { "stroke": "#374151", "dash": "solid" },
    "edge.async":     { "stroke": "#374151", "dash": "dashed" }
  }
}
```

## Layout Density

Compact. Use minimum gaps (80px between nodes). Fit more on canvas.

## Background

White (`#ffffff`) or very light gray (`#f9fafb`).
