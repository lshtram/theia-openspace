# Package Diagram

**Purpose:** Show namespace/package organization and the import or access dependencies between packages.

**diagramType:** `package`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `package` | `rectangle` | A UML package or namespace (use label `«package» com.example.auth`) |
| `class` | `rectangle` | A class inside a package (smaller, offset +20px from package edges) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `import` | Package imports public elements from another (dashed, `«import»`) |
| `access` | Private access to elements in another package (dashed, `«access»`) |
| `dependency` | General dependency between packages |
| `merge` | Package merges content of another (`«merge»`) |

## Semantics Fields

```json
"semantics": {
  "namespace": "com.example.auth",
  "visibility": "public"
}
```

## Layout Convention

- Packages as large rectangles: w=240, h=180
- Classes nested inside: offset +20px from package boundary, w=160, h=50
- Package-to-package spacing: 300px
- Dependencies flow left-to-right or top-to-bottom

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "package",
  "metadata": { "title": "Auth Package Structure", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "pkg-auth",     "kind": "package", "label": "«package»\ncom.example.auth",   "layout": { "x": 40,  "y": 60,  "w": 240, "h": 200, "locked": false }, "semantics": { "namespace": "com.example.auth" },   "styleToken": "node.default" },
    { "id": "pkg-model",    "kind": "package", "label": "«package»\ncom.example.model",  "layout": { "x": 360, "y": 60,  "w": 240, "h": 200, "locked": false }, "semantics": { "namespace": "com.example.model" },  "styleToken": "node.default" },
    { "id": "class-service","kind": "class",   "label": "AuthService",                   "layout": { "x": 60,  "y": 110, "w": 160, "h": 50,  "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "class-user",   "kind": "class",   "label": "User",                          "layout": { "x": 380, "y": 110, "w": 160, "h": 50,  "locked": false }, "semantics": {}, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "e1", "from": "pkg-auth", "to": "pkg-model", "relation": "import", "label": "«import»", "styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Connecting classes across packages directly** — Show package-level dependencies, not class-level (unless the diagram specifically documents class cross-references).
2. **Missing stereotype on package label** — Always prefix the label with `«package»` for UML compliance.
