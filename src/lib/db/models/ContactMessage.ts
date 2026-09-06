import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Contact-form submissions from /contact-us. Stored so a message is never lost
 * even if the email send is unavailable, and so the IP can be counted for rate
 * limiting (5/hour). Not TTL'd — these are support records.
 */
const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    ip: { type: String, index: true },
  },
  { timestamps: true },
);

contactMessageSchema.index({ createdAt: -1 });

export type ContactMessageDoc = InferSchemaType<typeof contactMessageSchema>;

export const ContactMessage: Model<ContactMessageDoc> =
  (models.ContactMessage as Model<ContactMessageDoc>) ??
  model<ContactMessageDoc>("ContactMessage", contactMessageSchema);

export default ContactMessage;
