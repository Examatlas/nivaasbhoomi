/**
 * Minimal transactional email sender. Uses Resend's REST API over plain fetch
 * (no npm dependency, works on Vercel's Edge/Node runtimes). Configured by two
 * env vars:
 *
 *   RESEND_API_KEY   your Resend API key
 *   EMAIL_FROM       verified sender, e.g. "NivaasBhoomi <no-reply@yourdomain>"
 *
 * If either is missing, sending is a no-op reporting `configured: false` so the
 * caller can apply a documented dev fallback (return the link in development) —
 * exactly like the WhatsApp client. We never throw; failures are values.
 */
export interface MailResult {
  configured: boolean;
  delivered: boolean;
  id?: string;
  error?: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<MailResult> {
  if (!emailConfigured()) return { configured: false, delivered: false };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { id?: string } | null;
      return { configured: true, delivered: true, id: data?.id };
    }
    const body = await res.text().catch(() => "");
    return { configured: true, delivered: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
  } catch (e) {
    return {
      configured: true,
      delivered: false,
      error: e instanceof Error ? e.message : "email send failed",
    };
  }
}
