"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * The listing's reference id, shown so a buyer can quote it to support (the id
 * is otherwise only hidden inside the WhatsApp "[Ref: …]" tag). A copy button
 * puts the exact id on the clipboard.
 */
export function ListingId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="inline-flex items-center gap-2 text-meta text-muted-foreground">
      <span>
        Property ID: <span className="tabular font-medium text-foreground">{id}</span>
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy property ID"
        className="inline-flex items-center gap-1 rounded-control border border-border px-1.5 py-0.5 text-subtle-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
      >
        {copied ? (
          <>
            <Check className="size-3 text-success-700" /> Copied
          </>
        ) : (
          <>
            <Copy className="size-3" /> Copy
          </>
        )}
      </button>
    </div>
  );
}
