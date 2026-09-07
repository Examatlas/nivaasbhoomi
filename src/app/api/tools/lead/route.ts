import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import { ToolSubmitLog } from "@/lib/db/models/ToolSubmitLog";
import { getTool } from "@/lib/tools/registry";
import { createToolLead } from "@/lib/tools/lead";
import { toolRateLimitDecision, TOOL_RATE_WINDOW_SECONDS } from "@/lib/tools/rate-limit";

/**
 * POST /api/tools/lead   [buyer auth]   { tool, input }
 *
 * The shared lead-magnet submit endpoint. The buyer must be signed in (the tool
 * UI runs the existing WhatsApp OTP first for logged-out users, or skips it when
 * already logged in). Recomputes the tool output SERVER-SIDE (never trusts the
 * client), creates an UNASSIGNED tool lead (deduped), and returns the result.
 * Rate limited 5/hour/IP.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tool: z.string().trim().min(1).max(60),
  input: z.unknown(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail("VALIDATION_ERROR", "A tool and its input are required.");

  const tool = getTool(parsed.data.tool);
  if (!tool) return fail("VALIDATION_ERROR", "Unknown tool.");

  const validated = tool.parse(parsed.data.input);
  if (!validated.ok) return fail("VALIDATION_ERROR", validated.error);

  await connectDB();

  // Rate limit: 5 tool submissions per hour per IP.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ipCount = await ToolSubmitLog.countDocuments({
    ip,
    createdAt: { $gte: new Date(Date.now() - TOOL_RATE_WINDOW_SECONDS * 1000) },
  });
  const rate = toolRateLimitDecision(ipCount);
  if (!rate.allowed) {
    return fail("RATE_LIMITED", "Too many submissions. Please try again later.", {
      retryAfter: rate.retryAfter,
    });
  }

  const user = await User.findById(auth.identity.userId, { phone: 1, name: 1 }).lean();
  if (!user?.phone) return fail("UNAUTHORIZED", "Please sign in again.");

  const output = tool.compute(validated.input) as Record<string, unknown>;
  const { leadId, deduped } = await createToolLead({
    tool,
    input: validated.input,
    output,
    phone: user.phone,
    name: user.name ?? null,
  });
  await ToolSubmitLog.create({ ip, tool: tool.name });

  return ok({ output, leadId, deduped });
});
