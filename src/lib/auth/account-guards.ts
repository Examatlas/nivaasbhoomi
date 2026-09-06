import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { Dealer } from "@/lib/db/models/Dealer";
import { User } from "@/lib/db/models/User";

/**
 * Uniqueness guards for login credentials. A collision on email would break the
 * password-reset lookup (which resolves an account by email across BOTH spaces),
 * so email must be unique across Dealers AND Users; phone must be unique across
 * Dealers (the WhatsApp/OTP identifier).
 */

/** True if `email` is already used by another Dealer or any User. Excludes the
 *  given dealer so their own current email never counts as a collision. */
export async function emailInUse(email: string, exceptDealerId?: string): Promise<boolean> {
  await connectDB();
  const e = email.trim().toLowerCase();
  if (!e) return false;
  const dealerFilter: Record<string, unknown> = { email: e };
  if (exceptDealerId && mongoose.Types.ObjectId.isValid(exceptDealerId)) {
    dealerFilter._id = { $ne: new mongoose.Types.ObjectId(exceptDealerId) };
  }
  const [d, u] = await Promise.all([Dealer.exists(dealerFilter), User.exists({ email: e })]);
  return Boolean(d || u);
}

/** True if `phone` is already used by another Dealer (excludes the given one). */
export async function phoneInUse(phone: string, exceptDealerId?: string): Promise<boolean> {
  await connectDB();
  if (!phone) return false;
  const filter: Record<string, unknown> = { phone };
  if (exceptDealerId && mongoose.Types.ObjectId.isValid(exceptDealerId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(exceptDealerId) };
  }
  return Boolean(await Dealer.exists(filter));
}
