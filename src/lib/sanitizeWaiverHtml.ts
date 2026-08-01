import DOMPurify from "dompurify";

// Client-only counterpart to sanitizeWaiverHtmlServer.ts — every call site
// of this function is a "use client" component (RegistrationWizard.tsx,
// WaiverEditorSection.tsx), so this only ever runs in a real browser. Uses
// plain dompurify (the browser's native DOM, zero Node dependencies) rather
// than isomorphic-dompurify, which pulled jsdom (11MB) into the server
// bundle via Next's SSR module tracing even though jsdom was never actually
// used by these two call sites — pushed the Cloudflare Worker over the
// free-tier 3MiB gzip size limit. The actual server-side save path
// (settings/waiver/actions.ts) has never used this file — it uses
// sanitizeWaiverHtmlServer.ts (sanitize-html, no jsdom) instead, since
// Cloudflare Workers can't run jsdom at all regardless of bundle size.
//
// Waiver text is authored via a contenteditable rich-text box in Settings
// and rendered on the public, unauthenticated /register page — sanitizing
// here too (on top of the server-side save) is defense in depth: a bypass
// of one is still caught by the other. Allow-list deliberately minimal — no
// headings, links, images, tables, or any attributes at all.
const WAIVER_ALLOWED_TAGS = ["p", "br", "b", "strong", "i", "em", "ul", "ol", "li"];

export function sanitizeWaiverHtml(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml ?? "", {
    ALLOWED_TAGS: WAIVER_ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}
