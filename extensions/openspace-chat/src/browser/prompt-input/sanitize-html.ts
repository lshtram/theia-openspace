/**
 * HTML sanitization for safe innerHTML assignment.
 *
 * Uses DOMPurify for battle-tested XSS protection.
 * Extracted from the prompt-input monolith during god-object decomposition (Phase 4c).
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML for safe innerHTML assignment.
 * Uses DOMPurify with a strict allowlist that preserves safe structural
 * elements like spans (pills) and divs while stripping all XSS vectors.
 */
export function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['span', 'div', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'code', 'pre', 'a'],
        ALLOWED_ATTR: ['class', 'data-mention-id', 'data-mention-type', 'href', 'title'],
        ALLOW_DATA_ATTR: false,
    });
}
