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
  build: ({ buyerName, count, area, budget, token }) => [
    ...body(buyerName, count, area, budget),
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] },
  ],
};

/** All templates keyed by name, for the client + admin tooling. */
export const TEMPLATES = {
  lead_assigned: leadAssigned,
  listing_expiry_warning: listingExpiryWarning,
  site_visit_reminder: siteVisitReminder,
  review_request: reviewRequest,
  followup_nudge: followupNudge,
  property_alert: propertyAlert,
} as const;

export type TemplateName = keyof typeof TEMPLATES;
