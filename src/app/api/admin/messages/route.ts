import type { NextRequest } from "next/server";

import { ok, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { ContactMessage } from "@/lib/db/models/ContactMessage";

/** GET /api/admin/messages   [admin] — contact-form submissions, newest first. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await connectDB();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);
  const [rows, total, unread] = await Promise.all([
    ContactMessage.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    ContactMessage.countDocuments({}),
    ContactMessage.countDocuments({ readAt: null }),
  ]);

  return ok({
    rows: rows.map((m) => ({
      id: String(m._id),
      name: m.name,
      email: m.email,
      phone: m.phone ?? null,
      subject: m.subject,
      message: m.message,
      read: Boolean(m.readAt),
      createdAt: new Date((m.createdAt as Date) ?? new Date()).toISOString(),
    })),
    total,
    unread,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
});
