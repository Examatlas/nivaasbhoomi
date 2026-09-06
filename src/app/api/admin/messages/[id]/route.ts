import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { ContactMessage } from "@/lib/db/models/ContactMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({ read: z.boolean() });

/** PATCH /api/admin/messages/[id]   [admin] — toggle read/unread. */
export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: RouteContext<"/api/admin/messages/[id]">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("VALIDATION_ERROR", "Invalid id.");

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) return fail("VALIDATION_ERROR", "A read flag is required.");

    await connectDB();
    const res = await ContactMessage.updateOne(
      { _id: id },
      { $set: { readAt: parsed.data.read ? new Date() : null } },
    );
    if (res.matchedCount === 0) return fail("NOT_FOUND", "Message not found.");
    return ok({ id, read: parsed.data.read });
  },
);

/** DELETE /api/admin/messages/[id]   [admin]. */
export const DELETE = withErrorHandling(
  async (_req: NextRequest, ctx: RouteContext<"/api/admin/messages/[id]">) => {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail("VALIDATION_ERROR", "Invalid id.");

    await connectDB();
    const res = await ContactMessage.deleteOne({ _id: id });
    if (res.deletedCount === 0) return fail("NOT_FOUND", "Message not found.");
    return ok({ id, deleted: true });
  },
);
