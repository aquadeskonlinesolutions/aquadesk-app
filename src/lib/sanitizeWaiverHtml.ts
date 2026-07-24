import DOMPurify from "isomorphic-dompurify";

// Waiver text is authored via a contenteditable rich-text box in Settings
// and rendered on the public, unauthenticated /register page — sanitize on
// both the save side and the render side (defense in depth: a bypass of
// one is still caught by the other). Allow-list deliberately minimal — no
// headings, links, images, tables, or any attributes at all.
const WAIVER_ALLOWED_TAGS = ["p", "br", "b", "strong", "i", "em", "ul", "ol", "li"];

export function sanitizeWaiverHtml(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml ?? "", {
    ALLOWED_TAGS: WAIVER_ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}
