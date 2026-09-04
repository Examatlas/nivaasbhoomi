import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star, Info } from "lucide-react";

import { getReviewContext } from "@/lib/leads/reviews";
import { ReviewForm } from "@/components/public/review-form";

export const metadata: Metadata = {
  title: "Rate your experience",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: PageProps<"/review/[leadId]">) {
  const { leadId } = await params;
  const ctx = await getReviewContext(leadId);
  if (!ctx) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <Star className="size-8 text-clay-500" />
        <h1 className="text-display-sm">Rate your experience</h1>
        <p className="text-sm text-muted-foreground">
          with <span className="font-medium text-ink-800">{ctx.dealerName}</span>
        </p>
      </div>

      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        {ctx.reviewable ? (
          <ReviewForm leadId={ctx.leadId} dealerName={ctx.dealerName} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Info className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{ctx.reason}</p>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-meta text-subtle-foreground">
        Reviews are only accepted from buyers who completed a site visit — that keeps
        ratings honest.
      </p>
    </div>
  );
}
