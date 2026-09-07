import type { Metadata } from "next";
import { CheckCircle2, AlertTriangle, XCircle, MapPin } from "lucide-react";

import { getRateAdminStats } from "@/lib/rates/admin";
import { Badge } from "@/components/ui/badge";
import { RatesComputeButton } from "@/components/admin/rates-compute-button";

export const metadata: Metadata = { title: "Admin — Locality rates" };
export const dynamic = "force-dynamic";

const QUALITY_TONE: Record<string, "success" | "warning" | "danger"> = {
  sufficient: "success",
  low: "warning",
  insufficient: "danger",
};

export default async function AdminRatesPage() {
  const s = await getRateAdminStats();
  const remaining = Math.max(0, s.readinessTarget - s.readyLocalities);

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-display-sm">Locality rate data</h1>
          <p className="mt-1 text-muted-foreground">
            Price aggregates from approved listings. Public rate pages (P4B) launch once enough
            localities have <b>sufficient</b> data.
          </p>
        </div>
        <RatesComputeButton />
      </div>

      {/* Readiness banner */}
      <div
        className={
          "mb-6 rounded-card border px-4 py-4 " +
          (s.readinessMet
            ? "border-success-100 bg-success-50 text-success-700"
            : "border-warning-100 bg-warning-50 text-warning-700")
        }
      >
        <p className="font-semibold">
          {s.readinessMet
            ? `Ready for P4B: ${s.readyLocalities} localities have sufficient data (target ${s.readinessTarget}).`
            : `P4B needs at least ${s.readinessTarget} localities with sufficient data. You have ${s.readyLocalities} — ${remaining} to go.`}
        </p>
        {s.lastComputedAt && (
          <p className="mt-1 text-meta">Last computed {new Date(s.lastComputedAt).toLocaleString("en-IN")}.</p>
        )}
      </div>

      {/* Quality cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QCard icon={CheckCircle2} tone="success" label="Sufficient" value={s.sufficientAggregates} sub="aggregates (public-ready)" />
        <QCard icon={AlertTriangle} tone="warning" label="Low" value={s.lowAggregates} sub="show with a warning" />
        <QCard icon={XCircle} tone="danger" label="Insufficient" value={s.insufficientAggregates} sub="never shown publicly" />
      </div>

      {/* City breakdown */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-ink-950">
          <MapPin className="size-5 text-clay-600" /> Public-ready localities by city
        </h2>
        {s.cityBreakdown.length === 0 ? (
          <p className="rounded-card border border-border bg-surface px-4 py-8 text-center text-muted-foreground">
            No city has public-ready localities yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">City</th>
                  <th className="px-3 py-2 font-medium">Ready localities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {s.cityBreakdown.map((c) => (
                  <tr key={c.cityId} className="bg-surface">
                    <td className="px-3 py-2 font-medium text-ink-950">{c.cityName}</td>
                    <td className="px-3 py-2 text-ink-900">{c.readyLocalities}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Top localities by sample size */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink-950">Top localities by listing count</h2>
        {s.topLocalities.length === 0 ? (
          <p className="rounded-card border border-border bg-surface px-4 py-8 text-center text-muted-foreground">
            No aggregates yet — run <b>Compute now</b>.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Locality</th>
                  <th className="px-3 py-2 font-medium">City</th>
                  <th className="px-3 py-2 font-medium">Type · Purpose</th>
                  <th className="px-3 py-2 font-medium">Samples</th>
                  <th className="px-3 py-2 font-medium">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {s.topLocalities.map((t, i) => (
                  <tr key={i} className="bg-surface">
                    <td className="px-3 py-2 font-medium text-ink-950">{t.localityName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.cityName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.propertyType} · {t.purpose}</td>
                    <td className="px-3 py-2 text-ink-900">{t.sampleCount}</td>
                    <td className="px-3 py-2">
                      <Badge tone={QUALITY_TONE[t.dataQuality] ?? "warning"} size="sm">{t.dataQuality}</Badge>
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

function QCard({ icon: Icon, tone, label, value, sub }: { icon: React.ElementType; tone: "success" | "warning" | "danger"; label: string; value: number; sub: string }) {
  const ring = tone === "success" ? "text-success-600" : tone === "warning" ? "text-warning-600" : "text-danger-600";
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-meta text-muted-foreground">
        <Icon className={`size-4 ${ring}`} /> {label}
      </div>
      <p className="mt-1 text-2xl font-semibold text-ink-950">{value}</p>
      <p className="text-meta text-muted-foreground">{sub}</p>
    </div>
  );
}
