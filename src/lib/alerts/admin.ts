import { connectDB } from "@/lib/db/connect";
import { SavedSearch } from "@/lib/db/models/SavedSearch";
import { AlertLog } from "@/lib/db/models/AlertLog";
import { City } from "@/lib/db/models/City";

export interface AlertAdminStats {
  activeSearches: number;
  totalSubscribers: number; // distinct phones with an active alert
  unsubscribedPhones: number;
  alertsSent: number;
  alertsDelivered: number;
  deliveryRate: number; // 0..1
  cityBreakdown: { cityId: string; cityName: string; count: number }[];
  recent: {
    phone: string; // masked
    listingCount: number;
    status: string;
    at: string;
  }[];
}

/** Admin analytics for property alerts (Phase 3). */
export async function getAlertAdminStats(): Promise<AlertAdminStats> {
  await connectDB();

  const [activeSearches, totalSends, delivered, activePhones, unsubPhones, cityAgg, recentDocs] =
    await Promise.all([
      SavedSearch.countDocuments({ active: true, unsubscribedAt: null }),
      AlertLog.countDocuments({}),
      AlertLog.countDocuments({ status: "sent" }),
      SavedSearch.distinct("phone", { active: true, unsubscribedAt: null }),
      SavedSearch.distinct("phone", { unsubscribedAt: { $ne: null } }),
      SavedSearch.aggregate<{ _id: unknown; count: number }>([
        { $match: { active: true, unsubscribedAt: null } },
        { $group: { _id: "$criteria.cityId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]),
      AlertLog.find({}).sort({ createdAt: -1 }).limit(50).lean(),
    ]);

  const cityIds = cityAgg.map((c) => c._id).filter(Boolean);
  const cities = await City.find({ _id: { $in: cityIds } }, { name: 1 }).lean();
  const cityName = new Map(cities.map((c) => [String(c._id), c.name]));

  return {
    activeSearches,
    totalSubscribers: activePhones.length,
    unsubscribedPhones: unsubPhones.length,
    alertsSent: totalSends,
    alertsDelivered: delivered,
    deliveryRate: totalSends > 0 ? delivered / totalSends : 0,
    cityBreakdown: cityAgg.map((c) => ({
      cityId: String(c._id),
      cityName: cityName.get(String(c._id)) ?? "Unknown city",
      count: c.count,
    })),
    recent: recentDocs.map((r) => ({
      phone: `***${String(r.phone).slice(-4)}`,
      listingCount: r.listingCount ?? 0,
      status: String(r.status),
      at: new Date((r.createdAt as Date) ?? new Date()).toISOString(),
    })),
  };
}
