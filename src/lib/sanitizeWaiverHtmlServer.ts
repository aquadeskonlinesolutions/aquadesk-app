import "server-only";
import sanitizeHtml from "sanitize-html";

// Server-only counterpart to sanitizeWaiverHtml.ts, used exclusively by the
// Waiver save Server Action (settings/waiver/actions.ts). isomorphic-dompurify
// needs jsdom, which fails under the Cloudflare Workers runtime
// ("Failed to load external module jsdom...no such file or directory,
// readAll '/browser/default-stylesheet.css'", confirmed live) — sanitize-html
// depends only on htmlparser2 (a pure-JS parser, no DOM emulation), so it
// works there. The two client-side call sites (RegistrationWizard.tsx,
// WaiverEditorSection.tsx) run in the visitor's real browser and are
// unaffected by this, so they keep using isomorphic-dompurify unchanged.
// Same allow-list as sanitizeWaiverHtml.ts — keep both in sync if it ever
// changes.
const WAIVER_ALLOWED_TAGS = ["p", "br", "b", "strong", "i", "em", "ul", "ol", "li"];

export function sanitizeWaiverHtmlServer(rawHtml: string): string {
  return sanitizeHtml(rawHtml ?? "", {
    allowedTags: WAIVER_ALLOWED_TAGS,
    allowedAttributes: {},
  });
}
