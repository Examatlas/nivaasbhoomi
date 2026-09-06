"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, MailOpen, Trash2, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/lib/api/client";

interface Row {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminMessagesList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ rows: Row[]; unread: number }>("/api/admin/messages");
      setRows(data.rows);
      setUnread(data.unread);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleRead(r: Row) {
    setBusyId(r.id);
    try {
      await apiFetch(`/api/admin/messages/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ read: !r.read }),
      });
      setRows((cur) => cur.map((x) => (x.id === r.id ? { ...x, read: !x.read } : x)));
      setUnread((u) => u + (r.read ? 1 : -1));
    } catch {
      /* ignore — visible state stays */
    } finally {
      setBusyId(null);
    }
  }

  async function remove(r: Row) {
    if (!confirm("Delete this message permanently?")) return;
    setBusyId(r.id);
    try {
      await apiFetch(`/api/admin/messages/${r.id}`, { method: "DELETE" });
      setRows((cur) => cur.filter((x) => x.id !== r.id));
      if (!r.read) setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (error) return <p className="py-8 text-center text-sm text-danger-700">{error}</p>;
  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No messages yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-meta text-muted-foreground">
        {rows.length} message{rows.length === 1 ? "" : "s"} · {unread} unread
      </p>
      {rows.map((r) => (
        <div
          key={r.id}
          className={
            "rounded-card border bg-surface p-4 " +
            (r.read ? "border-border" : "border-clay-200 bg-clay-50/40")
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink-950">{r.subject}</span>
                {!r.read && (
                  <Badge tone="clay" size="sm">
                    New
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-meta text-muted-foreground">
                {r.name} · <a href={`mailto:${r.email}`} className="text-clay-700 hover:underline">{r.email}</a>
                {r.phone ? (
                  <>
                    {" "}
                    · <Phone className="inline size-3" /> {r.phone}
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-meta text-muted-foreground">{fmt(r.createdAt)}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleRead(r)}
                disabled={busyId === r.id}
              >
                {r.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                {r.read ? "Unread" : "Read"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(r)}
                disabled={busyId === r.id}
                className="text-danger-700"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-ink-800">{r.message}</p>
        </div>
      ))}
    </div>
  );
}
