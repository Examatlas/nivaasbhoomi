import type { JsonLdObject } from "@/lib/seo/jsonld";

/**
 * Injects one or more JSON-LD objects as <script type="application/ld+json">.
 * Server component - rendered inside a page's markup. JSON.stringify drops any
 * `undefined` fields, so builders can conditionally omit keys cleanly.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const nodes = Array.isArray(data) ? data : [data];
  return (
    <>
      {nodes.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          // JSON-LD is trusted, server-built data; escape < to avoid breaking out
          // of the script element.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(node).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
