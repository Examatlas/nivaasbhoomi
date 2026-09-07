import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per successful dealer self-signup (a Dealer CREATED via
 * /api/users/me/upgrade), used only for anti-spam rate limiting: 3 signups per
 * hour per IP. A TTL index drops rows after an hour so the count is naturally
 * windowed. Kept separate from OtpRequestLog (that meters OTP sends by phone).
 */
const dealerSignupLogSchema = new Schema({
  ip: { type: String, index: true },
  createdAt: { type: Date, default: Date.now },
});

// TTL: drop the log row 3600s after it was created (the rate window).
dealerSignupLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export type DealerSignupLogDoc = InferSchemaType<typeof dealerSignupLogSchema>;

export const DealerSignupLog: Model<DealerSignupLogDoc> =
  (models.DealerSignupLog as Model<DealerSignupLogDoc>) ??
  model<DealerSignupLogDoc>("DealerSignupLog", dealerSignupLogSchema);

export default DealerSignupLog;
