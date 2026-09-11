/**
 * WhatsApp message templates (DEV-SPEC.txt Section 11).
 *
 * Templates are the ONLY way to message a user outside the 24-hour service
 * window. Each entry below mirrors a template that must be created + approved in
 * the Meta WhatsApp Manager under the SAME name and category; the `build()`
 * function produces the Cloud API `components` array from typed params.
 *
 * Meta approves the template TEXT there, not here - so the copy in comments is
 * the reference wording each template body should use, with {{1}}, {{2}} … as
 * the positional variables the build() fills in order.
 */

export type TemplateCategory = "utility" | "marketing";

/** A Cloud API template component (body params, button params, …). */
export interface TemplateComponent {
  type: "body" | "button" | "header";
  sub_type?: string;
  index?: string;
  parameters: { type: "text"; text: string }[];
}

interface TemplateDef<P> {
  name: string;
  category: TemplateCategory;
  /** Default language; can be overridden per send. */
  language: string;
  /** Number of body variables ({{1}}..{{n}}) the WABA template is registered
   *  with. Used to VALIDATE bodyParams length before any upstream call. */
  bodyVarCount: number;
  /** True if the template has a dynamic URL button (needs a buttonParams entry). */
  hasUrlButton?: boolean;
  build: (params: P) => TemplateComponent[];
}

function body(...texts: (string | number)[]): TemplateComponent[] {
  return [
    {
      type: "body",
      parameters: texts.map((t) => ({ type: "text", text: String(t) })),
    },
  ];
}

// NOTE: login OTP is handled by the dedicated OTP login flow
// (src/app/api/auth/otp/*), which calls the Meta Cloud API directly — it is not
// part of this automation template registry.

// ---- lead_assigned (utility) — to the dealer ----
// "New lead! {{1}} ({{2}}) wants property in {{3}}, budget {{4}}, timeline {{5}}.
//  Contact them now on WhatsApp to respond first."
// Params carry the BUYER's details so the assigned dealer can act (a lead is
// private to its assigned dealer, Section 13). Order = {{1}}..{{5}}.
export interface LeadAssignedParams {
  buyerName: string;
  buyerPhone: string;
  budget: string;
  locality: string;
  timeline: string;
}
export const leadAssigned: TemplateDef<LeadAssignedParams> = {
  name: "lead_assigned",
  category: "utility",
  language: "en",
  bodyVarCount: 5,
  build: ({ buyerName, buyerPhone, budget, locality, timeline }) =>
    body(buyerName, buyerPhone, budget, locality, timeline),
};

// ---- listing_expiry_warning (utility) — to the dealer, day 25 ----
// "Hi {{1}}, your listing “{{2}}” expires in {{3}} days. Refresh it to keep it live."
export interface ListingExpiryWarningParams {
  dealerName: string;
  listingTitle: string;
  daysLeft: string;
}
export const listingExpiryWarning: TemplateDef<ListingExpiryWarningParams> = {
  name: "listing_expiry_warning",
  category: "utility",
  language: "en",
  bodyVarCount: 3,
  build: ({ dealerName, listingTitle, daysLeft }) =>
    body(dealerName, listingTitle, daysLeft),
};

// ---- site_visit_reminder (utility) — to the buyer ----
// "Reminder: your site visit for {{1}} is on {{2}}. Reply here if you need to reschedule."
export interface SiteVisitReminderParams {
  listingTitle: string;
  visitSlot: string;
}
export const siteVisitReminder: TemplateDef<SiteVisitReminderParams> = {
  name: "site_visit_reminder",
  category: "utility",
  language: "en",
  bodyVarCount: 2,
  build: ({ listingTitle, visitSlot }) => body(listingTitle, visitSlot),
};

// ---- review_request (utility) — to the buyer, after a visit ----
// "How was your visit for {{1}} with {{2}}? Reply with a rating from 1 to 5."
// "How was your visit with {{1}}? Leave a quick rating here: {{2}}"
export interface ReviewRequestParams {
  dealerName: string;
  reviewUrl: string;
}
export const reviewRequest: TemplateDef<ReviewRequestParams> = {
  name: "review_request",
  category: "utility",
  language: "en",
  bodyVarCount: 2,
  build: ({ dealerName, reviewUrl }) => body(dealerName, reviewUrl),
};

// ---- followup_nudge (marketing) — to a dormant lead ----
// "Still looking for {{1}} in {{2}}? We have fresh options. Reply to see them."
export interface FollowupNudgeParams {
  requirement: string;
  area: string;
}
export const followupNudge: TemplateDef<FollowupNudgeParams> = {
  name: "followup_nudge",
  category: "marketing",
  language: "en",
  bodyVarCount: 2,
  build: ({ requirement, area }) => body(requirement, area),
};

// ---- property_alert (marketing) — to the buyer, from a saved search ----
// "Hi {{1}}, {{2}} new propert(y/ies) in {{3}} within {{4}} just listed on
//  NivaasBhoomi. Tap to view." + a URL button → /alerts?t=<token>
// The template NAME is env-configurable (WHATSAPP_TEMPLATE_PROPERTY_ALERT).
export interface PropertyAlertParams {
  buyerName: string;
  count: string;
  area: string;
  budget: string;
  /** Signed token for the URL button (opens /alerts, records a visit). */
  token: string;
}
export const propertyAlert: TemplateDef<PropertyAlertParams> = {
  name: (process.env.WHATSAPP_TEMPLATE_PROPERTY_ALERT ?? "property_alert").trim() || "property_alert",
  category: "marketing",
  language: "en",
  bodyVarCount: 4,
  hasUrlButton: true,
  build: ({ buyerName, count, area, budget, token }) => [
    ...body(buyerName, count, area, budget),
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] },
  ],
};

// ══ Dealer lifecycle notifications (Phase 1) — all UTILITY, to the dealer ══
// Event-driven (admin actions), multi-variable, so they always send via Meta
// (Zenith's template endpoint only takes OTP-shape params — see provider.ts).

// ---- dealer_approved (utility) — dealer verified (Tier 0 → Tier ≥1) ----
// "Congratulations {{1}}! Your NivaasBhoomi dealer account is verified. Your
//  listings can now go live."
export interface DealerApprovedParams {
  dealerName: string;
}
export const dealerApproved: TemplateDef<DealerApprovedParams> = {
  name: "dealer_approved",
  category: "utility",
  language: "en",
  bodyVarCount: 1,
  build: ({ dealerName }) => body(dealerName),
};

// ---- listing_approved (utility) — a listing went live ----
// "Hi {{1}}, your listing “{{2}}” is now live on NivaasBhoomi." + a URL button
// that opens the listing. The button is a DYNAMIC url: Meta appends {{1}} to the
// template's configured base URL — configured as
//   https://www.nivaasbhoomi.com/property/{{1}}
// so the dynamic part we send is the listing SLUG.
export interface ListingApprovedParams {
  dealerName: string;
  listingTitle: string;
  /** Listing slug — the dynamic suffix of the button URL (/property/<slug>). */
  listingSlug: string;
}
export const listingApproved: TemplateDef<ListingApprovedParams> = {
  name: "listing_approved",
  category: "utility",
  language: "en",
  bodyVarCount: 2,
  hasUrlButton: true,
  build: ({ dealerName, listingTitle, listingSlug }) => [
    ...body(dealerName, listingTitle),
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: listingSlug }] },
  ],
};

// ---- listing_rejected (utility) — a listing was rejected, with reason ----
// "Hi {{1}}, your listing “{{2}}” could not be approved. Reason: {{3}}. Please
//  edit and resubmit."
export interface ListingRejectedParams {
  dealerName: string;
  listingTitle: string;
  reason: string;
}
export const listingRejected: TemplateDef<ListingRejectedParams> = {
  name: "listing_rejected",
  category: "utility",
  language: "en",
  bodyVarCount: 3,
  build: ({ dealerName, listingTitle, reason }) => body(dealerName, listingTitle, reason),
};

// ---- listing_updated (utility) — an admin/staff edited the dealer's listing ----
// "Hi {{1}}, your listing “{{2}}” was updated by our team: {{3}}."
export interface ListingUpdatedParams {
  dealerName: string;
  listingTitle: string;
  changeSummary: string;
}
export const listingUpdated: TemplateDef<ListingUpdatedParams> = {
  name: "listing_updated",
  category: "utility",
  language: "en",
  bodyVarCount: 3,
  build: ({ dealerName, listingTitle, changeSummary }) =>
    body(dealerName, listingTitle, changeSummary),
};

/** All templates keyed by name, for the client + admin tooling. */
export const TEMPLATES = {
  lead_assigned: leadAssigned,
  listing_expiry_warning: listingExpiryWarning,
  site_visit_reminder: siteVisitReminder,
  review_request: reviewRequest,
  followup_nudge: followupNudge,
  property_alert: propertyAlert,
  dealer_approved: dealerApproved,
  listing_approved: listingApproved,
  listing_rejected: listingRejected,
  listing_updated: listingUpdated,
} as const;

export type TemplateName = keyof typeof TEMPLATES;

/** Zenith's confirmed multi-variable template body (see scripts/ probe findings). */
export interface ZenithButtonParam {
  index: number;
  type: "url";
  value: string;
}
export interface ZenithTemplateBody {
  template: string;
  language: string;
  bodyParams: string[];
  buttonParams?: ZenithButtonParam[];
}

/**
 * Convert a typed template + params into Zenith's confirmed request shape
 * ({ template, language, bodyParams, buttonParams? }), deriving the values from
 * the SAME build() the Meta path uses (so there's one source of truth), and
 * VALIDATING before any upstream call:
 *   - bodyParams length MUST equal the template's registered bodyVarCount
 *     (else Meta 132000), and
 *   - a template with a URL button MUST carry a non-empty button value
 *     (else Meta 131008).
 * A mismatch throws a clear, field-named error so the caller never makes a blind
 * upstream call. Language is always "en" (the registered template language).
 */
export function toZenithParams<N extends TemplateName>(
  name: N,
  params: Parameters<(typeof TEMPLATES)[N]["build"]>[0],
): ZenithTemplateBody {
  const tpl = TEMPLATES[name];
  const components = tpl.build(params as never);

  const bodyComp = components.find((c) => c.type === "body");
  const bodyParams = (bodyComp?.parameters ?? []).map((p) => p.text);

  const buttonParams: ZenithButtonParam[] = components
    .filter((c) => c.type === "button" && c.sub_type === "url")
    .map((c) => ({
      index: Number(c.index ?? "0"),
      type: "url" as const,
      value: c.parameters?.[0]?.text ?? "",
    }));

  if (bodyParams.length !== tpl.bodyVarCount) {
    throw new Error(
      `Zenith template "${tpl.name}": expected ${tpl.bodyVarCount} body param(s), got ${bodyParams.length}.`,
    );
  }
  if (tpl.hasUrlButton && !buttonParams.some((b) => b.value.trim().length > 0)) {
    throw new Error(
      `Zenith template "${tpl.name}": requires a URL button parameter but none was provided.`,
    );
  }

  return {
    template: tpl.name,
    language: "en",
    bodyParams,
    ...(buttonParams.length ? { buttonParams } : {}),
  };
}
