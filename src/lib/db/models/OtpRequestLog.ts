import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per OTP-send attempt, used only for rate limiting (3/hour/phone,
 * 10/hour/IP). A TTL index drops rows after an hour so counts are naturally
 * windowed. Kept separate from the `otps` collection because that holds only
 * one active code per phone (deleted on resend), which can't express a rate.
 */
const otpRequestLogSchema = new Schema({
  phone: { type: String, required: true, index: true },
  ip: { type: String, index: true },
  createdAt: { type: Date, default: Date.now },
});

// TTL: drop the log row 3600s after it was created.
otpRequestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export type OtpRequestLogDoc = InferSchemaType<typeof otpRequestLogSchema>;

export const OtpRequestLog: Model<OtpRequestLogDoc> =
  (models.OtpRequestLog as Model<OtpRequestLogDoc>) ??
  model<OtpRequestLogDoc>("OtpRequestLog", otpRequestLogSchema);

export default OtpRequestLog;
