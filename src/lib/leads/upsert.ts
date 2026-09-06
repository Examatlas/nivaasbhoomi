import mongoose from "mongoose";

import { Lead } from "@/lib/db/models/Lead";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";

/**
 * Shared "upsert a lead from AI-extracted fields" logic (DEV-SPEC.txt Section
 * 11). Used by BOTH the (now dormant) Meta+n8n webhook pipeline and the Zenith
 * Code ingest endpoint, so a qualified lead is created identically no matter how
 * it arrived. The lead is created UNASSIGNED; the caller runs routeLead().
 */

export interface ExtractedFields {
  name?: string;
  purpose?: string;
  propertyType?: string;
  bhk?: string;
  budgetMin?: number;
  budgetMax?: number;
  timeline?: string;
  loanRequired?: boolean;
  cityName?: string;
  localityName?: string;
  siteVisitSlot?: string;
}

export interface UpsertLeadArgs {
  phone: string;
  profileName?: string;
  listingId: string | null;
  /** Prefer updating this lead if set (the conversation's linked lead). */
  convLeadId?: string | null;
  extracted: ExtractedFields;
  qualificationScore?: number;
  isQualified: boolean;
  stage?: "greeting" | "qualifying" | "qualified" | "closing";
}

export async function upsertLead(args: UpsertLeadArgs): Promise<string | null> {
  const { cityId, localityId } = await resolveLocationIds(
    args.extracted.cityName,
    args.extracted.localityName,
  );

  // Only set fields that were actually provided, so a later message can't blank
  // an earlier extraction.
  const set: Record<string, unknown> = {
    waProfileName: args.profileName,
    isQualified: args.isQualified,
  };
  const e = args.extracted;
  if (e.name) set.name = e.name;
  if (e.purpose) set.purpose = e.purpose;
  if (e.propertyType) set.propertyType = e.propertyType;
  if (e.bhk) set.bhk = e.bhk;
  if (typeof e.budgetMin === "number") set.budgetMin = e.budgetMin;
  if (typeof e.budgetMax === "number") set.budgetMax = e.budgetMax;
  if (e.timeline) set.timeline = e.timeline;
  if (typeof e.loanRequired === "boolean") set.loanRequired = e.loanRequired;
  if (e.siteVisitSlot) set.siteVisitSlot = e.siteVisitSlot;
  if (typeof args.qualificationScore === "number")
    set.qualificationScore = args.qualificationScore;
  if (args.stage) set.stage = args.stage;
  if (cityId) set.cityId = cityId;
  if (localityId) set.localityId = localityId;

  // listingId is intentionally NOT part of `set`. On an ASSIGNED lead the primary
  // listing must never move — overwriting it made a dealer see a listing that
  // isn't theirs. Applied explicitly below (primary on create / when unassigned;
  // otherwise recorded as secondary context).
  const listingObjId =
    args.listingId && mongoose.Types.ObjectId.isValid(args.listingId)
      ? new mongoose.Types.ObjectId(args.listingId)
      : null;

  // Continuity for the AI pipeline comes ONLY from the conversation's linked
  // lead. There is deliberately NO phone-only reuse here — buyer-contact dedup
  // (phone + dealer + listing, 24h) lives in lib/leads/dedupe and is applied by
  // the contact paths before they create a lead.
  const lead =
    args.convLeadId && mongoose.Types.ObjectId.isValid(args.convLeadId)
      ? await Lead.findById(args.convLeadId)
      : null;

  if (lead) {
    lead.set(set);
    if (listingObjId) {
      if (lead.assignedDealerId) {
        // Locked to a dealer: freeze the primary listing. Record interest in
        // ANOTHER listing as secondary context only (deduped, never the primary).
        // Assignment, lock, quota and exclusivity are all untouched.
        const isPrimary = lead.listingId ? lead.listingId.equals(listingObjId) : false;
        const already = (lead.otherListingIds ?? []).some((x) => x.equals(listingObjId));
        if (!isPrimary && !already) {
          lead.otherListingIds = [...(lead.otherListingIds ?? []), listingObjId];
        }
      } else {
        // Not yet assigned — routing may still use this listing, so keep the
        // previous behaviour (the bug only affects already-assigned leads).
        lead.listingId = listingObjId;
      }
    }
    await lead.save();
    return String(lead._id);
  }

  const created = await Lead.create({
    phone: args.phone,
    source: args.listingId ? "listing" : "generic",
    status: "new",
    ...set,
    ...(listingObjId ? { listingId: listingObjId } : {}),
  });
  return String(created._id);
}

/** Best-effort resolve of AI city/locality NAMES to ids (null when unknown). */
export async function resolveLocationIds(
  cityName?: string,
  localityName?: string,
): Promise<{ cityId?: mongoose.Types.ObjectId; localityId?: mongoose.Types.ObjectId }> {
  const out: { cityId?: mongoose.Types.ObjectId; localityId?: mongoose.Types.ObjectId } = {};
  if (cityName) {
    const city = await City.findOne(
      { name: new RegExp(`^${escapeRegex(cityName)}$`, "i") },
      { _id: 1 },
    ).lean();
    if (city) {
      out.cityId = city._id as mongoose.Types.ObjectId;
      if (localityName) {
        const loc = await Locality.findOne(
          { cityId: city._id, name: new RegExp(`^${escapeRegex(localityName)}$`, "i") },
          { _id: 1 },
        ).lean();
        if (loc) out.localityId = loc._id as mongoose.Types.ObjectId;
      }
    }
  }
  return out;
}

/** The [Ref: <id>] tag the CTA embeds -> the listing's _id. */
export function parseListingRef(message: string): string | null {
  const m = message.match(/\[Ref:\s*([a-fA-F0-9]{24})\]/);
  return m ? m[1]! : null;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
