import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { Lead } from "@/lib/db/models/Lead";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";

/**
 * DEV-ONLY: set up / inspect / reset test dealers so lead routing (Section 12)
 * can be exercised end to end - ranking, round-robin, quota, coverage.
 * REFUSES in production. Test dealers use synthetic phones prefixed 99900 and
 * businessName "RT: <label>" so they're easy to spot and clean up.
 *
 *   POST /api/dev/routing-setup  { action, ... }
 *     seed:    { cityName, localityNames?, dealers:[{label,tier,rating,maxLeads,used,localities?,lastAssignedAgoMin?}] }
 *     inspect: {}
 *     reset:   {}
 *
 * Tier is forced directly (updateOne bypasses the derive hook) so a test dealer
 * can sit at any tier without real documents - dev convenience only.
 */
const isProd = process.env.NODE_ENV === "production";
const TEST_PHONE_PREFIX = "99900";

const dealerSchema = z.object({
  label: z.string().min(1).max(20),
  tier: z.number().int().min(0).max(4).default(1),
  rating: z.number().min(0).max(5).default(4),
  maxLeads: z.number().int().min(0).max(1000).default(10),
  used: z.number().int().min(0).max(1000).default(0),
  status: z.enum(["active", "paused", "banned"]).default("active"),
  localities: z.array(z.string()).optional(),
  lastAssignedAgoMin: z.number().optional(),
});

const bodySchema = z.object({
  action: z.enum(["seed", "inspect", "reset"]),
  cityName: z.string().optional(),
  localityNames: z.array(z.string()).optional(),
  dealers: z.array(dealerSchema).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (isProd) return fail("FORBIDDEN", "routing-setup is disabled in production.");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Invalid setup.", parsed.error.flatten());
  }
  await connectDB();

  if (parsed.data.action === "reset") return reset();
  if (parsed.data.action === "inspect") return inspect();
  return seed(parsed.data);
});

async function seed(data: z.infer<typeof bodySchema>) {
  if (!data.cityName || !data.dealers?.length) {
    return fail("VALIDATION_ERROR", "seed needs cityName and at least one dealer.");
  }
  const city = await City.findOne(
    { name: new RegExp(`^${escape(data.cityName)}$`, "i") },
    { _id: 1, name: 1 },
  ).lean();
  if (!city) return fail("NOT_FOUND", `City "${data.cityName}" not found.`);

  // Resolve every referenced locality name -> id within the city.
  const wanted = new Set<string>([...(data.localityNames ?? [])]);
  for (const d of data.dealers) (d.localities ?? []).forEach((l) => wanted.add(l));
  const locDocs = wanted.size
    ? await Locality.find(
        {
          cityId: city._id,
          name: { $in: [...wanted].map((n) => new RegExp(`^${escape(n)}$`, "i")) },
        },
        { _id: 1, name: 1 },
      ).lean()
    : [];
  const locIdByName = new Map(locDocs.map((l) => [l.name.toLowerCase(), String(l._id)]));

  const now = Date.now();
  const created: unknown[] = [];
  let i = 0;
  for (const d of data.dealers) {
    i += 1;
    const phone = `${TEST_PHONE_PREFIX}${String(i).padStart(5, "0")}`;
    const covLoc = (d.localities ?? [])
      .map((n) => locIdByName.get(n.toLowerCase()))
      .filter(Boolean) as string[];

    // Upsert identity, then force the routing-relevant fields directly
    // (updateOne bypasses the tier-derive hook, so tier sticks).
    await Dealer.updateOne(
      { phone },
      {
        $setOnInsert: {
          name: `RT ${d.label}`,
          businessName: `RT: ${d.label}`,
          slug: `rt-${d.label.toLowerCase()}-${i}`,
        },
        $set: {
          status: d.status,
          verificationTier: d.tier,
          rating: d.rating,
          maxLeadsPerMonth: d.maxLeads,
          leadsUsedThisMonth: d.used,
          coverageCities: [city._id],
          coverageLocalities: covLoc.map((id) => new mongoose.Types.ObjectId(id)),
          lastAssignedAt:
            d.lastAssignedAgoMin != null
              ? new Date(now - d.lastAssignedAgoMin * 60_000)
              : null,
        },
      },
      { upsert: true },
    );
    created.push({ label: d.label, phone, tier: d.tier, coverageLocalities: covLoc.length });
  }

  return ok({
    city: { id: String(city._id), name: city.name },
    localitiesResolved: [...locIdByName.entries()].map(([name, id]) => ({ name, id })),
    dealers: created,
    hint: "Now POST /api/dev/whatsapp-sim with mockAi { isQualified:true } to route a lead; use action:inspect here to see counts.",
  });
}

async function inspect() {
  const dealers = await Dealer.find(
    { phone: new RegExp(`^${TEST_PHONE_PREFIX}`) },
    {
      businessName: 1,
      phone: 1,
      status: 1,
      verificationTier: 1,
      rating: 1,
      maxLeadsPerMonth: 1,
      leadsUsedThisMonth: 1,
      lastAssignedAt: 1,
      totalLeadsReceived: 1,
      coverageLocalities: 1,
    },
  )
    .sort({ businessName: 1 })
    .lean();

  const rows = await Promise.all(
    dealers.map(async (d) => ({
      id: String(d._id),
      businessName: d.businessName,
      phone: d.phone,
      status: d.status,
      tier: d.verificationTier,
      rating: d.rating,
      quota: `${d.leadsUsedThisMonth}/${d.maxLeadsPerMonth}`,
      totalLeadsReceived: d.totalLeadsReceived,
      lastAssignedAt: d.lastAssignedAt ? new Date(d.lastAssignedAt).toISOString() : null,
      coverageLocalities: (d.coverageLocalities ?? []).length,
      assignedLeadCount: await Lead.countDocuments({ assignedDealerId: d._id }),
    })),
  );
  return ok({ dealers: rows });
}

async function reset() {
  const dealers = await Dealer.find(
    { phone: new RegExp(`^${TEST_PHONE_PREFIX}`) },
    { _id: 1 },
  ).lean();
  const ids = dealers.map((d) => d._id);
  const leads = await Lead.deleteMany({ assignedDealerId: { $in: ids } });
  const del = await Dealer.deleteMany({ phone: new RegExp(`^${TEST_PHONE_PREFIX}`) });
  return ok({ deletedDealers: del.deletedCount, deletedAssignedLeads: leads.deletedCount });
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
