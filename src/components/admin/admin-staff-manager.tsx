"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus, Power, Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/lib/api/client";

interface StaffRow {
  _id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  lastLoginAt: string | null;
  dealersOnboarded: number;
  listingsPublished: number;
}

interface ActivityRow {
  at: string;
  action: string;
  dealerId: string | null;
  listingId: string | null;
  metadata: Record<string, unknown> | null;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminStaffManager() {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openActivity, setOpenActivity] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await apiFetch<StaffRow[]>("/api/admin/staff"));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load staff.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(row: StaffRow) {
    const action = row.status === "active" ? "deactivate" : "activate";
    if (action === "deactivate" && !confirm(`Deactivate ${row.name}? This ends their sessions immediately.`)) {
      return;
    }
    try {
      await apiFetch(`/api/admin/staff/${row._id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update staff.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <CreateStaff onDone={load} />

      {error && <p className="text-sm text-danger-700">{error}</p>}

      {rows === null ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          No staff accounts yet. Create one above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-muted text-left text-meta text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Staff</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Dealers</th>
                <th className="px-3 py-2 font-medium">Listings</th>
                <th className="px-3 py-2 font-medium">Last login</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <Fragment key={r._id}>
                  <tr className="bg-surface">
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink-950">{r.name}</div>
                      <div className="text-meta text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={r.status === "active" ? "success" : "danger"} size="sm">
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 tabular text-muted-foreground">{r.dealersOnboarded}</td>
                    <td className="px-3 py-2 tabular text-muted-foreground">{r.listingsPublished}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDateTime(r.lastLoginAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenActivity(openActivity === r._id ? null : r._id)}
                          className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-meta font-medium text-ink-700 hover:bg-surface-muted"
                        >
                          <Activity className="size-3.5" /> Activity
                        </button>
                        <Button
                          size="sm"
                          variant={r.status === "active" ? "outline" : "primary"}
                          onClick={() => toggle(r)}
                        >
                          <Power className="size-4" />
                          {r.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {openActivity === r._id && (
                    <tr className="bg-surface-muted/40">
                      <td colSpan={6} className="px-3 py-3">
                        <StaffActivity staffId={r._id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateStaff({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await apiFetch("/api/admin/staff", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      setName("");
      setEmail("");
      setPassword("");
      setOk(true);
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create staff.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-card border border-border bg-surface p-5">
      <h2 className="mb-4 text-lg font-semibold text-ink-950">Add a staff account</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-name" required>
            Name
          </Label>
          <Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-email" required>
            Email
          </Label>
          <Input id="cs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-password" required>
            Temporary password
          </Label>
          <Input
            id="cs-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-danger-700">{error}</p>}
      {ok && !error && <p className="mt-3 text-sm text-success-700">Staff account created.</p>}
      <div className="mt-4">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Create staff
        </Button>
      </div>
    </form>
  );
}

function StaffActivity({ staffId }: { staffId: string }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<ActivityRow[]>(`/api/admin/staff/${staffId}/activity`);
        if (alive) setRows(data);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load activity.");
        setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [staffId]);

  if (rows === null) {
    return (
      <div className="flex items-center gap-2 text-meta text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading activity…
      </div>
    );
  }
  if (error) return <p className="text-meta text-danger-700">{error}</p>;
  if (rows.length === 0) {
    return <p className="text-meta text-muted-foreground">No recorded activity yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5 text-meta">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="tabular text-muted-foreground">{fmtDateTime(r.at)}</span>
          <span className="rounded-full bg-ink-50 px-2 py-0.5 font-medium text-ink-700">{r.action}</span>
          {r.dealerId && <span className="tabular text-muted-foreground">dealer {r.dealerId}</span>}
          {r.listingId && <span className="tabular text-muted-foreground">listing {r.listingId}</span>}
        </li>
      ))}
    </ul>
  );
}
