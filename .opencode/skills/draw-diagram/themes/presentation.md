# Presentation Theme

**Use when:** Slides, demos, stakeholder walkthroughs, executive summaries, conference talks.

**Character:** Bold colors, large text targets, generous spacing, clear visual hierarchy.

## Style Block

```json
"style": {
  "theme": "presentation",
  "tokens": {
    "node.default":   { "stroke": "#1e293b", "fill": "#ffffff", "font": "sans-serif" },
    "node.accent":    { "stroke": "#7c3aed", "fill": "#ede9fe", "font": "sans-serif" },
    "node.external":  { "stroke": "#64748b", "fill": "#f8fafc", "font": "sans-serif" },
    "node.system":    { "stroke": "#7c3aed", "fill": "#ddd6fe", "font": "sans-serif" },
    "edge.default":   { "stroke": "#334155", "dash": "solid" },
    "edge.dashed":    { "stroke": "#94a3b8", "dash": "dashed" },
    "edge.message":   { "stroke": "#1e293b", "dash": "solid" },
    "edge.async":     { "stroke": "#64748b", "dash": "dashed" }
  }
}
```

## Layout Density

Spacious. Use generous gaps (120–160px between nodes). Fewer elements per slide.

## Sizing

Increase node size: typical node w=200, h=80. Labels should be short (3–5 words max).

## Background

White. Avoid dark backgrounds unless user explicitly requests.
