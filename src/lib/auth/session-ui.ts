/**
 * Pure helpers for the buyer session UI (header + profile prompt), so the
 * show/hide rules are unit-tested rather than hidden in components.
 */
export interface Me {
  authed: boolean;
  role?: "buyer";
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  profileComplete?: boolean;
}

/** The profile-completion popup shows only for a logged-in buyer who has no
 *  name yet AND has not dismissed it this session. */
export function shouldPromptProfileCompletion(me: Me | null, dismissed: boolean): boolean {
  if (!me || !me.authed) return false;
  if (dismissed) return false;
  return !me.name;
}

/** Avatar letter: first letter of the name, else of the phone, else "U". */
export function avatarInitial(name?: string | null, phone?: string | null): string {
  const n = (name ?? "").trim();
  if (n) return n[0]!.toUpperCase();
  const p = (phone ?? "").replace(/\D/g, "");
  if (p) return p[p.length - 1]!;
  return "U";
}

/** Display "+91 XXXXXXXXXX" from a canonical "91XXXXXXXXXX". */
export function formatSessionPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2)}`;
  return `+${digits}`;
}
