# RevealJS Syntax Reference

Complete syntax cheat sheet for OpenSpace presentations (`.deck.md` files).

---

## Table of Contents

1. [Frontmatter Options](#frontmatter-options)
2. [Slide Separators](#slide-separators)
3. [Slide Attributes](#slide-attributes)
4. [Element Attributes](#element-attributes)
5. [Backgrounds](#backgrounds)
6. [Fragments](#fragments)
7. [Transitions](#transitions)
8. [Code Blocks](#code-blocks)
9. [Auto-Animate](#auto-animate)
10. [Layout Helpers](#layout-helpers)
11. [Typography & Tables](#typography--tables)
12. [Media](#media)
13. [Math / LaTeX](#math--latex)
14. [Speaker Notes](#speaker-notes)
15. [Themes](#themes)
16. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Frontmatter Options

```yaml
---
title: Presentation Title           # REQUIRED — without this, presentation renders blank
author: Your Name                   # Optional
theme: openspace-modern             # Theme name (see Themes section)
transition: slide                   # Default slide transition
transitionSpeed: default            # default | fast | slow
backgroundTransition: fade          # Background change transition
controls: true                      # Show navigation arrows
progress: true                      # Show progress bar
slideNumber: "c/t"                  # Slide numbers: true | false | "h.v" | "h/v" | "c" | "c/t"
loop: false                         # Loop at end
autoSlide: 0                        # Auto-advance ms (0 = off)
autoSlideStoppable: true            # Stop auto-advance on user input
touch: true                         # Touch navigation
mouseWheel: false                   # Mouse wheel navigation
overview: true                      # Enable overview mode (ESC)
defaultTiming: 120                  # Seconds per slide for speaker view pacing
totalTime: 1800                     # Total presentation time in seconds
pdfSeparateFragments: true          # Each fragment on separate PDF page
parallaxBackgroundImage: 'url'      # Parallax background image URL
parallaxBackgroundSize: '2100px 900px'
parallaxBackgroundHorizontal: 200
parallaxBackgroundVertical: 50
---
```

---

## Slide Separators

```markdown
# Slide 1
Horizontal navigation (left/right arrows)

---

# Slide 2
Another horizontal slide

===

# Slide 2.1
Vertical slide — nested under Slide 2 (up/down arrows)

===

# Slide 2.2
Another vertical slide under Slide 2

---

# Slide 3
Back to horizontal
```

**Rules:**
- `---` = horizontal separator (left/right navigation)
- `===` = vertical separator (up/down navigation, nested under previous horizontal slide)
- The first `---` closes the YAML frontmatter
- Plain markdown headers WITHOUT separators = blank presentation

---

## Slide Attributes

Place immediately before slide content using HTML comments:

```markdown
<!-- .slide: attribute="value" attribute2="value2" -->
# Slide Title
```

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-background-color` | CSS color | Solid color background |
| `data-background-gradient` | CSS gradient | Gradient background |
| `data-background-image` | path/url | Image background |
| `data-background-video` | path/url | Video background |
| `data-background-iframe` | url | Iframe background |
| `data-background-opacity` | 0–1 | Background opacity |
| `data-background-size` | `cover` \| `contain` \| size | Background sizing |
| `data-background-position` | CSS position | Background position |
| `data-background-repeat` | CSS repeat | Background repeat |
| `data-background-transition` | transition name | Per-slide bg transition |
| `data-auto-animate` | (no value) | Enable auto-animate from previous |
| `data-auto-animate-id` | string | Group slides for auto-animate |
| `data-auto-animate-restart` | (no value) | Break auto-animate chain |
| `data-auto-animate-duration` | seconds | Animation duration |
| `data-auto-animate-easing` | CSS easing | Animation easing function |
| `data-transition` | transition name | Per-slide transition |
| `data-transition-speed` | `default` \| `fast` \| `slow` | Transition speed |
| `data-timing` | seconds | Speaker view slide timing |
| `data-visibility` | `hidden` | Skip slide in navigation |
| `data-notes` | string | Speaker notes |
| `class` | CSS class | Add CSS class to slide |

---

## Element Attributes

Apply to the element immediately preceding the comment:

```markdown
- List item <!-- .element: class="fragment" -->
- Another item <!-- .element: class="fragment fade-up" -->

<p> <!-- .element: class="fragment" data-fragment-index="2" -->
```

Or in HTML directly:

```html
<p class="fragment fade-up">Appears with slide-up fade</p>
```

---

## Backgrounds

### Solid Color
```markdown
<!-- .slide: data-background-color="#1a1a2e" -->
<!-- .slide: data-background-color="rgba(0,0,0,0.8)" -->
<!-- .slide: data-background-color="hsl(200, 50%, 20%)" -->
```

### Gradient
```markdown
<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f2027 0%, #2c5364 100%)" -->
<!-- .slide: data-background-gradient="radial-gradient(#283b95, #17b2c3)" -->
<!-- .slide: data-background-gradient="conic-gradient(from 45deg, #283b95, #17b2c3)" -->
```

### Image
```markdown
<!-- .slide: data-background-image="path/to/image.jpg" -->
<!-- .slide: data-background-image="image.jpg" data-background-opacity="0.3" -->
<!-- .slide: data-background-image="image.jpg" data-background-size="contain" -->
<!-- .slide: data-background-image="tile.png" data-background-size="100px" data-background-repeat="repeat" -->
```

Image options: `data-background-size` (`cover`/`contain`/size), `data-background-position`, `data-background-repeat`, `data-background-opacity` (0–1)

### Video
```markdown
<!-- .slide: data-background-video="video.mp4" -->
<!-- .slide: data-background-video="video.mp4,video.webm" data-background-video-loop data-background-video-muted -->
<!-- .slide: data-background-video="video.mp4" data-background-size="contain" -->
```

### Iframe
```markdown
<!-- .slide: data-background-iframe="https://example.com" -->
<!-- .slide: data-background-iframe="https://example.com" data-background-interactive -->
```

`data-background-interactive` allows interaction with the iframe (but blocks slide interaction).

---

## Fragments

Fragments reveal content progressively on click/keypress.

### Using HTML Comments (on markdown elements)
```markdown
- Item 1 <!-- .element: class="fragment" -->
- Item 2 <!-- .element: class="fragment fade-up" -->
- Item 3 <!-- .element: class="fragment" data-fragment-index="1" -->
```

### Using HTML Directly
```html
<p class="fragment">Fade in</p>
<p class="fragment fade-up">Slide up while fading in</p>
```

### All Fragment Styles

| Class | Effect |
|-------|--------|
| `fragment` | Fade in (default) |
| `fragment fade-out` | Start visible, fade out |
| `fragment fade-up` | Slide up while fading in |
| `fragment fade-down` | Slide down while fading in |
| `fragment fade-left` | Slide left while fading in |
| `fragment fade-right` | Slide right while fading in |
| `fragment fade-in-then-out` | Fade in, then out on next step |
| `fragment current-visible` | Visible only for one step (same as above) |
| `fragment fade-in-then-semi-out` | Fade in, then to 50% opacity |
| `fragment grow` | Scale up |
| `fragment shrink` | Scale down |
| `fragment semi-fade-out` | Fade to 50% opacity |
| `fragment strike` | Strike-through |
| `fragment highlight-red` | Turn text red |
| `fragment highlight-green` | Turn text green |
| `fragment highlight-blue` | Turn text blue |
| `fragment highlight-current-red` | Turn red, then revert on next step |
| `fragment highlight-current-green` | Turn green, then revert on next step |
| `fragment highlight-current-blue` | Turn blue, then revert on next step |

### Fragment Order
```html
<p class="fragment" data-fragment-index="3">Appears third</p>
<p class="fragment" data-fragment-index="1">Appears first</p>
<p class="fragment" data-fragment-index="2">Appears second</p>
```

### Nested Fragments (Multiple Effects on One Element)
```html
<span class="fragment fade-in">
  <span class="fragment highlight-red">
    <span class="fragment fade-out">
      Fade in → Turn red → Fade out
    </span>
  </span>
</span>
```

### Custom Fragment Effects
```html
<style>
  .fragment.blur { filter: blur(5px); opacity: 1; }
  .fragment.blur.visible { filter: none; }
</style>
<p class="fragment custom blur">Custom blur effect</p>
```

Add `custom` class to disable the default fade-in.

---

## Transitions

### Global (Frontmatter)
```yaml
transition: slide
transitionSpeed: default
```

### Per-Slide
```markdown
<!-- .slide: data-transition="zoom" -->
<!-- .slide: data-transition="slide" data-transition-speed="fast" -->
<!-- .slide: data-transition="slide-in fade-out" -->
<!-- .slide: data-transition="fade-in zoom-out" -->
```

### Available Transitions

| Name | Effect |
|------|--------|
| `none` | Instant |
| `fade` | Cross-fade |
| `slide` | Slide from right (default) |
| `convex` | Slide at convex angle |
| `concave` | Slide at concave angle |
| `zoom` | Scale from center |

### Speeds
- `default` — normal
- `fast` — quick
- `slow` — slow

### Background Transition (Per-Slide)
```markdown
<!-- .slide: data-background-transition="zoom" -->
```

---

## Code Blocks

### Basic with Syntax Highlighting
````markdown
```typescript
function greet(name: string): string {
  return `Hello, ${name}!`
}
```
````

Supported languages: `typescript`, `javascript`, `python`, `bash`, `json`, `yaml`, `html`, `css`, `sql`, `go`, `rust`, `java`, `markdown`, and all highlight.js supported languages.

### Line Numbers
````markdown
```typescript [data-line-numbers]
function example() {
  const a = 1
  const b = 2
  return a + b
}
```
````

### Step-by-Step Highlights (Click to Advance)
````markdown
```typescript [1-2|3-5|6-8]
// Step 1: Setup (lines 1-2 highlighted)
import { useState } from 'react'

// Step 2: Component (lines 3-5 highlighted)
function Counter() {
  const [count, setCount] = useState(0)

  // Step 3: Render (lines 6-8 highlighted)
  return <button onClick={() => setCount(c => c+1)}>{count}</button>
}
```
````

Syntax: `[lineSpec]` where lineSpec is comma-separated ranges, `|` separates steps.
Examples: `[1]`, `[1-3]`, `[1,3,5]`, `[1-3|5|7-10]`

### Line Number Offset
````markdown
```typescript [100: 1-3|4-5]
// Line numbers displayed starting at 100
function example() {
  return 'hello'
}
```
````

### Trim Whitespace
````markdown
```typescript [data-trim]
  // Leading/trailing whitespace removed
  function example() { return 'trimmed' }
```
````

### Disable HTML Escaping
````markdown
```html [data-noescape]
<div class="example">HTML tags preserved verbatim</div>
```
````

---

## Auto-Animate

Automatically animates matching elements between adjacent slides.

### Enable on Slides
```markdown
<!-- .slide: data-auto-animate -->
# Slide 1

---

<!-- .slide: data-auto-animate -->
# Slide 1
Now with more content — title animated to new position!
```

### Animatable CSS Properties
`position`, `font-size`, `line-height`, `color`, `background-color`, `padding`, `margin`, `opacity`, `border-width`, `border-color`, `border-radius`

### Manual Matching with data-id
```markdown
<!-- .slide: data-auto-animate -->
<div data-id="box" style="height: 50px; background: salmon;"></div>

---

<!-- .slide: data-auto-animate -->
<div data-id="box" style="height: 200px; background: blue;"></div>
```

### Code Block Animation (Growing Code)
```markdown
<!-- .slide: data-auto-animate -->
<pre data-id="code-block"><code data-trim data-line-numbers>
const handler = async (req) => {
  return { status: 200 }
}
</code></pre>

---

<!-- .slide: data-auto-animate -->
<pre data-id="code-block"><code data-trim data-line-numbers>
const handler = async (req) => {
  const user = await auth(req)
  if (!user) return { status: 401 }
  return { status: 200 }
}
</code></pre>
```

The `data-id` must match between slides. RevealJS animates added/removed/changed lines.

### Animation Settings

Per-slide:
```markdown
<!-- .slide: data-auto-animate data-auto-animate-duration="0.8" data-auto-animate-easing="ease-out" -->
```

Per-element:
```html
<div data-id="box" data-auto-animate-delay="0.2">...</div>
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-auto-animate-easing` | `ease` | CSS easing function |
| `data-auto-animate-duration` | `1.0` | Duration in seconds |
| `data-auto-animate-delay` | `0` | Element delay in seconds |
| `data-auto-animate-unmatched` | `true` | Fade in unmatched elements |

### Animation Groups
```markdown
<!-- .slide: data-auto-animate data-auto-animate-id="groupA" -->
...
<!-- .slide: data-auto-animate data-auto-animate-id="groupA" -->
...
<!-- .slide: data-auto-animate data-auto-animate-id="groupB" -->
...
```

### Break the Chain
```markdown
<!-- .slide: data-auto-animate data-auto-animate-restart -->
# New chain starts here
```

---

## Layout Helpers

### r-stack — Stacked Elements (Layered Reveals)

Centers and stacks elements on top of each other. Use with fragments for step-by-step image/content reveals:

```html
<div class="r-stack">
  <img class="fragment fade-out" data-fragment-index="0" src="step1.png" />
  <img class="fragment current-visible" data-fragment-index="0" src="step2.png" />
  <img class="fragment" src="step3.png" />
</div>
```

### r-fit-text — Fill Available Width

Makes text as large as possible without overflow:

```html
<h2 class="r-fit-text">BIG IMPACT TEXT</h2>
<h2 class="r-fit-text">SECOND LINE</h2>
```

### r-stretch — Fill Remaining Height

Stretches one element to fill remaining vertical space after other slide content:

```markdown
## Architecture Diagram
<img class="r-stretch" src="diagram.png" />
*Figure 1: System Overview*
```

Limitations: only works on direct children of slide sections; one element per slide.

### r-frame — Decorative Border

```html
<img class="r-frame" src="screenshot.png" />
```

### Two-Column Flex Layout

```html
<div style="display: flex; gap: 2em; text-align: left;">
  <div style="flex: 1;">

  **Left Column**
  - Item A
  - Item B

  </div>
  <div style="flex: 1;">

  **Right Column**
  - Item C
  - Item D

  </div>
</div>
```

---

## Typography & Tables

### Headings
```markdown
# H1 — Main slide title
## H2 — Subtitle or section
### H3 — Content heading
#### H4 — Minor heading
```

Best practice: H1 = slide title, H2 = subtitle, H3+ = content.

### Text Formatting
```markdown
**Bold**  *Italic*  ***Bold italic***  ~~Strikethrough~~
`inline code`
> Blockquote
<sup>Superscript</sup>  <sub>Subscript</sub>
```

### Tables
```markdown
| Left | Center | Right |
|:-----|:------:|------:|
| A    |   B    |     C |
```

### Styled Tables
```html
<style>
  .reveal table th { background: #e94560; color: white; }
  .reveal table { font-size: 0.75em; }
</style>

| Metric | Before | After |
|--------|--------|-------|
| Speed  | 3.2s   | 0.8s  |
```

---

## Media

### Images
```markdown
![Alt text](path/to/image.png)
<img src="image.png" width="400" />
<img class="r-stretch" src="image.png" />
<img class="r-frame" src="image.png" />
```

### Video
```html
<video data-autoplay src="video.mp4"></video>
<video data-autoplay loop muted controls>
  <source src="video.mp4" type="video/mp4">
</video>
```

### Lazy Loading (use `data-src` instead of `src`)
```html
<img data-src="image.png" />
<video data-src="video.mp4"></video>
<iframe data-src="page.html"></iframe>
```

### Lightbox
```html
<img src="thumbnail.png" data-preview-image="fullsize.png">
<img src="thumbnail.png" data-preview-video="video.mp4">
<a href="https://example.com" data-preview-link>Preview Link</a>
```

---

## Math / LaTeX

Requires Math plugin (enabled by default in OpenSpace):

```markdown
Block math:
$$E = mc^2$$

$$
\begin{aligned}
\dot{x} & = \sigma(y-x) \\
\dot{y} & = \rho x - y - xz
\end{aligned}
$$

Inline math: $E = mc^2$
```

---

## Speaker Notes

### Markdown Syntax (Recommended)
```markdown
# Slide Title

Visible slide content.

Note:
These notes are only shown in speaker view (press S).
Can be **markdown formatted**.
```

### HTML Syntax
```html
<aside class="notes">
  These are speaker notes.
  They support <strong>HTML</strong> too.
</aside>
```

### Slide Attribute
```markdown
<!-- .slide: data-notes="Quick reminder about this slide" -->
# Slide Title
```

### Speaker View Pacing
```yaml
# Per presentation (frontmatter)
defaultTiming: 120    # seconds per slide
totalTime: 1800       # total seconds

# Per slide (slide attribute)
<!-- .slide: data-timing="60" -->
```

---

## Themes

### OpenSpace Custom Themes (Recommended)

| Theme | Description | Best For |
|-------|-------------|----------|
| `openspace-modern` | Dark, gradient accents, Inter font | Code-heavy content, default |
| `openspace-ocean` | Blue tones, professional | Architecture diagrams |
| `openspace-sunset` | Warm orange/pink | Creative, design reviews |
| `openspace-forest` | Green, nature-inspired | Calm topics |

### Built-in RevealJS Themes

| Theme | Description |
|-------|-------------|
| `black` | Dark background (default) |
| `white` | Clean white |
| `moon` | Dark blue, soft |
| `night` | Dark with orange accents |
| `solarized` | Easy on eyes |
| `dracula` | Vibrant dark |
| `sky` | Light blue |
| `beige` | Warm readable |
| `league` | Grey with colorful accents |
| `serif` | Traditional serif fonts |
| `simple` | Minimal white |
| `blood` | Dark with red accents |

### CSS Custom Properties (for `<style>` block in deck)

```css
:root {
  /* Colors */
  --r-background-color: #191919;
  --r-main-color: #fff;
  --r-heading-color: #fff;
  --r-link-color: #42affa;
  --r-link-color-hover: #8dcffc;
  --r-selection-background: #bee4fd;

  /* Typography */
  --r-main-font: 'Inter', Helvetica, sans-serif;
  --r-heading-font: 'Inter', Helvetica, sans-serif;
  --r-main-font-size: 42px;
  --r-code-font: 'Fira Code', monospace;

  /* Spacing */
  --r-block-margin: 20px;
}
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` `↓` `Space` `PageDown` | Next slide |
| `←` `↑` `PageUp` | Previous slide |
| `Home` | First slide |
| `End` | Last slide |
| `ESC` or `O` | Overview mode (all slides) |
| `F` | Fullscreen |
| `S` | Speaker view |
| `B` or `.` | Pause / blackout screen |
| `?` | Help overlay |
| `Alt+Click` | Zoom into element |
