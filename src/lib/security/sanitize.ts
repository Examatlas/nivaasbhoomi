import sanitizeHtml from "sanitize-html";

/**
 * Sanitize dealer-supplied rich text (the profile "about" field). Allows a small
 * set of formatting tags and safe link attributes; strips scripts, styles, event
 * handlers, and any unknown tag/attribute — no stored XSS. Applied on SAVE (P4)
 * and again on READ here as defence-in-depth.
 */
export function sanitizeAbout(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li",
      "h3", "h4", "blockquote", "a",
    ],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["http", "https", "mailto"],
    // Links open safely and never pass PageRank from a dealer-controlled field.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "nofollow noopener noreferrer",
        target: "_blank",
      }),
    },
    disallowedTagsMode: "discard",
  }).trim();
}
