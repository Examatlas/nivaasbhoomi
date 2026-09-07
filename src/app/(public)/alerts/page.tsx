import type { Metadata } from "next";
import Link from "next/link";

import { getUserSession } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { SavedSearch } from "@/lib/db/models/SavedSearch";
import { City } from "@/lib/db/models/City";
import { Locality } from "@/lib/db/models/Locality";
import { verifyAlertToken, signAlertToken } from "@/lib/alerts/token";
import { formatBudgetRange } from "@/lib/alerts/logic";
import { AlertsManager, type AlertRow } from "@/components/alerts/alerts-manager";

export const metadata: Metadata = {
  title: "My property alerts",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function bhkLabel(b?: string | null): string {
  if (!b) return "";
  if (b === "1rk") return "1 RK";
  if (b === "5plus") return "5+ BHK";
  return `${b} BHK`;
}

export default async function AlertsPage({ searchParams }: PageProps<"/alerts"> ) {
  const sp = await searchParams;
  const tokenParam = typeof sp.t === "string" ? sp.t : undefined;
  const unsubscribed = sp.unsubscribed === "1";

  // Identify the buyer: a logged-in session, or a signed alert token (no login).
  const session = await getUserSession();
  let phone: string | null = null;
  let canManage = false;
  if (session) {
    await connectDB();
    const u = await User.findById(session.userId, { phone: 1 }).lean();
    phone = u?.phone ?? null;
    canManage = true;
  } else if (tokenParam) {
    const claims = await verifyAlertToken(tokenParam);
    phone = claims?.phone ?? null;
  }

  if (!phone) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-display-sm">Your property alerts</h1>
        <p className="mt-2 text-muted-foreground">
          Sign in to view and manage the alerts you&apos;ve set.
        </p>
        <Link href="/login?next=/alerts" className="mt-4 inline-flex rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
          Sign in
        </Link>
      </div>
    );
  }

  await connectDB();
  const docs = await SavedSearch.find({ phone }).sort({ createdAt: -1 }).lean();

  type Crit = {
    cityId: unknown;
    localityIds?: unknown[];
    purpose?: string;
    propertyType?: string | null;
    bedrooms?: string | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
  };
  const crit = (d: (typeof docs)[number]): Crit => (d.criteria ?? {}) as Crit;

  // Resolve city + locality names in bulk.
  const cityIds = [...new Set(docs.map((d) => String(crit(d).cityId)).filter(Boolean))];
  const locIds = [...new Set(docs.flatMap((d) => (crit(d).localityIds ?? []).map(String)))];
  const [cities, locs] = await Promise.all([
    City.find({ _id: { $in: cityIds } }, { name: 1, slug: 1 }).lean(),
    Locality.find({ _id: { $in: locIds } }, { name: 1, slug: 1, cityId: 1 }).lean(),
  ]);
  const cityName = new Map(cities.map((c) => [String(c._id), c.name]));
  const citySlug = new Map(cities.map((c) => [String(c._id), c.slug]));
  const locName = new Map(locs.map((l) => [String(l._id), l.name]));
  const locSlug = new Map(locs.map((l) => [String(l._id), l.slug]));

  const rows: AlertRow[] = docs.map((d) => {
    const c = crit(d);
    const cId = String(c.cityId);
    const firstLoc = (c.localityIds ?? [])[0] ? String((c.localityIds ?? [])[0]) : null;
    const where = firstLoc ? `${locName.get(firstLoc) ?? "locality"}, ${cityName.get(cId) ?? ""}` : (cityName.get(cId) ?? "city");
    const parts = [
      c.purpose === "rent" ? "Rent" : "Buy",
      bhkLabel(c.bedrooms),
      c.propertyType ?? "",
      `in ${where}`,
      formatBudgetRange(c.budgetMin, c.budgetMax),
    ].filter(Boolean);
    return {
      id: String(d._id),
      summary: parts.join(" · "),
      active: Boolean(d.active),
      unsubscribed: Boolean(d.unsubscribedAt),
      viewHref: firstLoc && locSlug.get(firstLoc) && citySlug.get(cId)
        ? `/${citySlug.get(cId)}/${locSlug.get(firstLoc)}`
        : citySlug.get(cId) ? `/${citySlug.get(cId)}` : "/search",
    };
  });

  const token = tokenParam ?? (await signAlertToken(phone));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-display-sm">Your property alerts</h1>
      <p className="mt-1 text-muted-foreground">
        We&apos;ll WhatsApp you when new matching properties are listed.
      </p>
      {unsubscribed && (
        <p className="mt-4 rounded-control border border-success-100 bg-success-50 px-3 py-2 text-sm text-success-700">
          You&apos;ve been unsubscribed from all property alerts. You can turn any back on below.
        </p>
      )}
      <AlertsManager rows={rows} canManage={canManage} unsubscribeToken={token} />
    </div>
  );
}
