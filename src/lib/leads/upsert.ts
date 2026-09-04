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
  if (args.listingId && mongoose.Types.ObjectId.isValid(args.listingId)) {
    set.listingId = new mongoose.Types.ObjectId(args.listingId);
  }

  // The conversation's linked lead, else the latest open lead for this phone,
  // else a new lead. (This is what makes re-processing idempotent: the same
  // phone maps to the same open lead, so routeLead sees it already assigned.)
  let lead =
    args.convLeadId && mongoose.Types.ObjectId.isValid(args.convLeadId)
      ? await Lead.findById(args.convLeadId)
      : null;
  if (!lead) {
    lead = await Lead.findOne({ phone: args.phone, status: { $nin: ["converted", "lost"] } })
      .sort({ createdAt: -1 })
      .exec();
  }

  if (lead) {
    lead.set(set);
    await lead.save();
    return String(lead._id);
  }

  const created = await Lead.create({
    phone: args.phone,
    source: args.listingId ? "listing" : "generic",
    status: "new",
    ...set,
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
