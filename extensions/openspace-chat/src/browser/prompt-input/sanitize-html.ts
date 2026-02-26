/**
 * HTML sanitization for safe innerHTML assignment.
 *
 * Extracted from the prompt-input monolith during god-object decomposition (Phase 4c).
 */

/**
 * Sanitize HTML for safe innerHTML assignment.
 * Strips dangerous elements (script, iframe, object, embed, form) and
 * removes inline event-handler attributes (on*) and javascript: URLs.
 * Preserves safe structural elements like spans (pills), divs, etc.
 */
export function sanitizeHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body;

    // Remove dangerous elements entirely
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base'];
    for (const tag of dangerousTags) {
        const els = body.querySelectorAll(tag);
        els.forEach(el => el.remove());
    }

    // Walk all remaining elements and strip dangerous attributes
    const allElements = body.querySelectorAll('*');
    for (const el of allElements) {
        // Remove inline event handlers (onclick, onerror, onmouseover, etc.)
        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
            if (attr.name.startsWith('on')) {
                el.removeAttribute(attr.name);
            }
        }
        // Remove javascript: URLs from href/src/action
        for (const urlAttr of ['href', 'src', 'action']) {
            const val = el.getAttribute(urlAttr);
            if (val && /^\s*javascript\s*:/i.test(val)) {
                el.removeAttribute(urlAttr);
            }
        }
    }

    return body.innerHTML;
}
