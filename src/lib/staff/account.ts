import { getStaffSession } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connect";
import { Staff } from "@/lib/db/models/Staff";

export interface MyStaff {
  staffId: string;
  name: string;
  email: string;
}

/**
 * The signed-in staff's basic profile (for panel chrome), or null. The session
 * itself is already validated against the live Staff record (status +
 * tokenVersion) by getStaffSession, so a deactivated account resolves to null.
 */
export async function getMyStaff(): Promise<MyStaff | null> {
  const identity = await getStaffSession();
  if (!identity) return null;
  await connectDB();
  const staff = await Staff.findById(identity.staffId, { name: 1, email: 1 }).lean();
  if (!staff) return null;
  return { staffId: identity.staffId, name: staff.name, email: staff.email };
}
