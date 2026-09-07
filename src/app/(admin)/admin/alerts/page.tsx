import type { Metadata } from "next";
import { Bell, Send, BellOff, MapPin } from "lucide-react";

import { getAlertAdminStats } from "@/lib/alerts/admin";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Admin — Property alerts" };
export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const s = await getAlertAdminStats();
  const deliveryPct = Math.round(s.deliveryRate * 100);

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-display-sm">Property alerts</h1>
        <p className="mt-1 text-muted-foreground">
          Saved searches and WhatsApp alert delivery. City demand shows where to bring inventory.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Bell} label="Active alerts" value={s.activeSearches} sub={`${s.totalSubscribers} subscribers`} />
        <Stat icon={Send} label="Alerts sent" value={s.alertsSent} sub={`${s.alertsDelivered} delivered`} />
        <Stat icon={Send} label="Delivery rate" value={`${deliveryPct}%`} sub={s.alertsSent === 0 ? "no sends yet" : "of all sends"} />
        <Stat icon={BellOff} label="Unsubscribed" value={s.unsubscribedPhones} sub="phones" />
      </div>

      {/* City demand */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-ink-950">
          <MapPin className="size-5 text-clay-600" /> Demand by city (active alerts)
        </h2>
        {s.cityBreakdown.length === 0 ? (
          <p className="rounded-card border border-border bg-surface px-4 py-8 text-center text-muted-foreground">
            No active alerts yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">City</th>
                  <th className="px-3 py-2 font-medium">Buyers waiting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {s.cityBreakdown.map((c) => (
                  <tr key={c.cityId} className="bg-surface">
                    <td className="px-3 py-2 font-medium text-ink-950">{c.cityName}</td>
                    <td className="px-3 py-2 text-ink-900">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent sends */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink-950">Recent alert sends</h2>
        {s.recent.length === 0 ? (
          <p className="rounded-card border border-border bg-surface px-4 py-8 text-center text-muted-foreground">
            No alerts sent yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Listings</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {s.recent.map((r, i) => (
                  <tr key={i} className="bg-surface">
                    <td className="px-3 py-2 text-muted-foreground">{r.phone}</td>
                    <td className="px-3 py-2 text-ink-900">{r.listingCount}</td>
                    <td className="px-3 py-2">
                      <Badge tone={r.status === "sent" ? "success" : "danger"} size="sm">{r.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-meta text-muted-foreground">
                      {new Date(r.at).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-meta text-muted-foreground">
        <Icon className="size-4 text-clay-600" /> {label}
      </div>
      <p className="mt-1 text-2xl font-semibold text-ink-950">{value}</p>
      {sub && <p className="text-meta text-muted-foreground">{sub}</p>}
    </div>
  );
}
