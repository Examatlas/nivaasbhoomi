import { AuditLog } from "@/lib/db/models/AuditLog";

/**
 * Append-only audit for dealer-scoped admin actions (convert-to-dealer, quota
 * change). Best-effort — a log failure never breaks the action.
 */
export async function logDealerAudit(entry: {
  action: "dealer.admin-convert" | "dealer.quota-adjust";
  actorId: string; // admin email / id
  dealerId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await AuditLog.create({
      action: entry.action,
      actorType: "admin",
      actorId: entry.actorId,
      dealerId: entry.dealerId,
      reason: entry.reason,
      metadata: entry.metadata,
    });
  } catch {
    /* audit is best-effort */
  }
}
