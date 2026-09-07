import { connectDB } from "@/lib/db/connect";
import { SavedSearch, type SavedSearchDoc } from "@/lib/db/models/SavedSearch";
import { AlertLog } from "@/lib/db/models/AlertLog";
import { Listing } from "@/lib/db/models/Listing";
import { User } from "@/lib/db/models/User";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { sendBusinessTemplate } from "@/lib/whatsapp/send";
import { signAlertToken } from "@/lib/alerts/token";
import {
  isWithinAlertWindowIST,
  buildListingMatchFilter,
  formatBudgetRange,
  shouldAutoPause,
  ALERT_DEDUP_HOURS,
  type AlertCriteria,
} from "@/lib/alerts/logic";

export interface AlertRunSummary {
  ranAt: string;
  skipped?: "outside_window";
  phonesScanned: number;
  messagesSent: number;
  phonesDeduped: number;
  noMatch: number;
  autoPaused: number;
}

type Search = SavedSearchDoc & { _id: unknown };

/**
 * The property-alert engine (called by the cron). Sends AT MOST one merged
 * WhatsApp alert per phone per 24h, only inside the 9am–8pm IST window, only for
 * NEW matching listings, and auto-pauses a search after 3 un-visited alerts.
 * Never throws to the caller.
 */
export async function runPropertyAlerts(now: Date = new Date()): Promise<AlertRunSummary> {
  const base: AlertRunSummary = {
    ranAt: now.toISOString(),
    phonesScanned: 0,
    messagesSent: 0,
    phonesDeduped: 0,
    noMatch: 0,
    autoPaused: 0,
  };

  // Outside the send window → do nothing (cron may run any time).
  if (!isWithinAlertWindowIST(now)) return { ...base, skipped: "outside_window" };

  await connectDB();

  const searches = (await SavedSearch.find({
    active: true,
    unsubscribedAt: null,
  }).lean()) as unknown as Search[];

  // Group active searches by phone (one merged message per phone).
  const byPhone = new Map<string, Search[]>();
  for (const s of searches) {
    const list = byPhone.get(s.phone) ?? [];
    list.push(s);
    byPhone.set(s.phone, list);
  }
  base.phonesScanned = byPhone.size;

  const since24h = new Date(now.getTime() - ALERT_DEDUP_HOURS * 60 * 60 * 1000);

  for (const [phone, phoneSearches] of byPhone) {
    // 24h dedup: at most one alert per phone per day, whatever the search count.
    const recent = await AlertLog.findOne({ phone, createdAt: { $gte: since24h } }, { _id: 1 }).lean();
    if (recent) {
      base.phonesDeduped += 1;
      continue;
    }

    // Gather NEW matching listings across all of this phone's searches (merged).
    const listingIds = new Set<string>();
    const contributing: { search: Search; newestListingId: string }[] = [];
    let mergedMin: number | null = null;
    let mergedMax: number | null = null;

    for (const s of phoneSearches) {
      const since = s.lastNotifiedAt ?? (s as unknown as { createdAt?: Date }).createdAt ?? new Date(0);
      const filter = buildListingMatchFilter(s.criteria as unknown as AlertCriteria, since);
      const listings = await Listing.find(filter, { _id: 1 }).sort({ createdAt: -1 }).limit(25).lean();
      if (listings.length === 0) continue;
      for (const l of listings) listingIds.add(String(l._id));
      contributing.push({ search: s, newestListingId: String(listings[0]!._id) });
      const c = s.criteria as { budgetMin?: number | null; budgetMax?: number | null };
      if (typeof c.budgetMin === "number") mergedMin = mergedMin == null ? c.budgetMin : Math.min(mergedMin, c.budgetMin);
      if (typeof c.budgetMax === "number") mergedMax = mergedMax == null ? c.budgetMax : Math.max(mergedMax, c.budgetMax);
    }

    if (listingIds.size === 0) {
      base.noMatch += 1;
      continue; // never send an empty alert
    }

    // Resolve message params.
    const first = contributing[0]!.search;
    const buyer = await User.findOne({ phone }, { name: 1 }).lean();
    const buyerName = buyer?.name?.trim() || "there";
    const area = await resolveArea(first);
    const budget = formatBudgetRange(mergedMin, mergedMax);
    const token = await signAlertToken(phone);

    const send = await sendBusinessTemplate(phone, "property_alert", {
      buyerName,
      count: String(listingIds.size),
      area,
      budget,
      token,
    }).catch((e: unknown) => ({
      delivered: false,
      messageId: undefined as string | undefined,
      error: e instanceof Error ? e.message : "send error",
    }));

    const firstCityId = (first.criteria as { cityId?: unknown }).cityId;
    await AlertLog.create({
      phone,
      searchIds: contributing.map((c) => String(c.search._id)),
      cityId: firstCityId ? String(firstCityId) : null,
      listingCount: listingIds.size,
      messageId: send.messageId ?? null,
      status: send.delivered ? "sent" : "failed",
    });

    if (!send.delivered) {
      // Template not approved / WhatsApp not configured → recorded as "failed"
      // in AlertLog above; skip gracefully (never throw, never crash the cron).
      console.warn(`[property-alerts] send not delivered phone=***${phone.slice(-4)} error=${(send as { error?: string }).error ?? "unknown"}`);
      continue;
    }

    base.messagesSent += 1;

    // Advance each contributing search + auto-pause dead audiences.
    for (const c of contributing) {
      const nextCount = ((c.search.alertsSinceVisit as number | undefined) ?? 0) + 1;
      const pause = shouldAutoPause(nextCount);
      if (pause) base.autoPaused += 1;
      await SavedSearch.updateOne(
        { _id: c.search._id },
        {
          $set: {
            lastNotifiedAt: now,
            lastSeenListingId: c.newestListingId,
            alertsSinceVisit: nextCount,
            ...(pause ? { active: false } : {}),
          },
        },
      );
    }
  }

  return base;
}

async function resolveArea(search: Search): Promise<string> {
  const c = search.criteria as { localityIds?: unknown[]; cityId?: unknown };
  const locId = (c.localityIds ?? [])[0];
  if (locId) {
    const loc = await Locality.findById(locId, { name: 1 }).lean();
    if (loc?.name) return loc.name;
  }
  if (c.cityId) {
    const city = await City.findById(c.cityId, { name: 1 }).lean();
    if (city?.name) return city.name;
  }
  return "your area";
}
