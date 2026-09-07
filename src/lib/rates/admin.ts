import { connectDB } from "@/lib/db/connect";
import { LocalityRate } from "@/lib/db/models/LocalityRate";
import { Locality } from "@/lib/db/models/Locality";
import { City } from "@/lib/db/models/City";
import { P4B_READINESS_MIN_LOCALITIES } from "@/lib/rates/config";

export interface RateAdminStats {
  sufficientAggregates: number;
  lowAggregates: number;
  insufficientAggregates: number;
  readyLocalities: number; // distinct localities with ≥1 "sufficient" aggregate
  readinessTarget: number;
  readinessMet: boolean;
  cityBreakdown: { cityId: string; cityName: string; readyLocalities: number }[];
  topLocalities: {
    localityId: string;
    localityName: string;
    cityName: string;
    propertyType: string;
    purpose: string;
    sampleCount: number;
    dataQuality: string;
  }[];
  lastComputedAt: string | null;
}

export async function getRateAdminStats(): Promise<RateAdminStats> {
  await connectDB();

  const [byQuality, readyLocalityIds, cityAgg, top, latest] = await Promise.all([
    LocalityRate.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$dataQuality", n: { $sum: 1 } } },
    ]),
    LocalityRate.distinct("localityId", { dataQuality: "sufficient" }),
    LocalityRate.aggregate<{ _id: unknown; localities: number }>([
      { $match: { dataQuality: "sufficient" } },
      { $group: { _id: { city: "$cityId", loc: "$localityId" } } },
      { $group: { _id: "$_id.city", localities: { $sum: 1 } } },
      { $sort: { localities: -1 } },
      { $limit: 50 },
    ]),
    LocalityRate.find({}).sort({ sampleCount: -1 }).limit(20).lean(),
    LocalityRate.findOne({}, { computedAt: 1 }).sort({ computedAt: -1 }).lean(),
  ]);

  const q = new Map(byQuality.map((r) => [r._id, r.n]));

  // Resolve names for the city breakdown + top localities.
  const cityIds = [
    ...new Set([
      ...cityAgg.map((c) => String(c._id)),
      ...top.map((t) => String(t.cityId)),
    ].filter(Boolean)),
  ];
  const locIds = [...new Set(top.map((t) => String(t.localityId)).filter(Boolean))];
  const [cities, locs] = await Promise.all([
    City.find({ _id: { $in: cityIds } }, { name: 1 }).lean(),
    Locality.find({ _id: { $in: locIds } }, { name: 1 }).lean(),
  ]);
  const cityName = new Map(cities.map((c) => [String(c._id), c.name]));
  const locName = new Map(locs.map((l) => [String(l._id), l.name]));

  const readyLocalities = readyLocalityIds.length;

  return {
    sufficientAggregates: q.get("sufficient") ?? 0,
    lowAggregates: q.get("low") ?? 0,
    insufficientAggregates: q.get("insufficient") ?? 0,
    readyLocalities,
    readinessTarget: P4B_READINESS_MIN_LOCALITIES,
    readinessMet: readyLocalities >= P4B_READINESS_MIN_LOCALITIES,
    cityBreakdown: cityAgg.map((c) => ({
      cityId: String(c._id),
      cityName: cityName.get(String(c._id)) ?? "Unknown city",
      readyLocalities: c.localities,
    })),
    topLocalities: top.map((t) => ({
      localityId: String(t.localityId),
      localityName: locName.get(String(t.localityId)) ?? "—",
      cityName: cityName.get(String(t.cityId)) ?? "—",
      propertyType: String(t.propertyType),
      purpose: String(t.purpose),
      sampleCount: t.sampleCount ?? 0,
      dataQuality: String(t.dataQuality),
    })),
    lastComputedAt: latest?.computedAt ? new Date(latest.computedAt).toISOString() : null,
  };
}
