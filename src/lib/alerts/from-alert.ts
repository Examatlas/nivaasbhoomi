import { cookies } from "next/headers";

/**
 * Short-lived flag cookie: set when a buyer opens a property-alert link, read
 * when they next create an enquiry lead so the admin can see it's a returning
 * high-intent buyer (Lead.fromAlert). Display-signal only — never affects
 * routing. httpOnly (server reads it), 7-day life.
 */
export const FROM_ALERT_COOKIE = "nb_from_alert";

export function fromAlertCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  };
}

/** True when the current request carries the from-alert flag. */
export async function isFromAlert(): Promise<boolean> {
  return (await cookies()).get(FROM_ALERT_COOKIE)?.value === "1";
}
