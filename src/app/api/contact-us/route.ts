import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { connectDB } from "@/lib/db/connect";
import { ContactMessage } from "@/lib/db/models/ContactMessage";
import { sendEmail } from "@/lib/email/mailer";
import { COMPANY } from "@/lib/legal/company";
import { BRAND } from "@/lib/seo/site";

/**
 * POST /api/contact-us   { name, email, phone?, subject, message, website? }
 *
 * The public contact form. The message is stored (so it is never lost) and
 * emailed to support. `website` is a honeypot — if a bot fills it, we return
 * success without doing anything. Rate limited to 5 submissions per hour per IP.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  phone: z.string().trim().max(20).optional(),
  subject: z.string().trim().min(2, "Please enter a subject.").max(160),
  message: z.string().trim().min(10, "Please enter a longer message.").max(4000),
  website: z.string().max(200).optional(), // honeypot
});

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export const POST = withErrorHandling(async (req: NextRequest) => {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Please check the form.", parsed.error.flatten());
  }
  const b = parsed.data;

  // Honeypot: a real user never fills this. Pretend success, do nothing.
  if (b.website && b.website.trim()) return ok({ sent: true });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  await connectDB();

  const recent = await ContactMessage.countDocuments({
    ip,
    createdAt: { $gte: new Date(Date.now() - RATE_WINDOW_MS) },
  });
  if (recent >= RATE_LIMIT) {
    return fail("RATE_LIMITED", "Too many messages from this network. Please try again later.");
  }

  // Store first — the message is never lost even if email is unavailable.
  await ContactMessage.create({
    name: b.name,
    email: b.email,
    phone: b.phone,
    subject: b.subject,
    message: b.message,
    ip,
  });

  const text =
    `New contact message via ${BRAND}\n\n` +
    `Name: ${b.name}\nEmail: ${b.email}\nPhone: ${b.phone || "—"}\n` +
    `Subject: ${b.subject}\n\n${b.message}\n`;
  const html =
    `<p><strong>New contact message via ${BRAND}</strong></p>` +
    `<p>Name: ${b.name}<br/>Email: ${b.email}<br/>Phone: ${b.phone || "—"}<br/>Subject: ${b.subject}</p>` +
    `<p style="white-space:pre-wrap">${b.message}</p>`;

  const result = await sendEmail({
    to: COMPANY.email,
    subject: `[Contact] ${b.subject}`,
    text,
    html,
  });
  if (!result.delivered) {
    // Not fatal — the message is stored and support can read it — but log it.
    console.error(
      `[contact-us] email not delivered (${result.configured ? result.error : "not configured"}); message stored.`,
    );
  }

  return ok({ sent: true });
});
