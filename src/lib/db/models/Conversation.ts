import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * Conversation (DEV-SPEC.txt Section 4). The rolling WhatsApp message log for a
 * phone number. windowExpiresAt tracks the 24-hour service window the WhatsApp
 * Cloud API enforces for free-form (non-template) replies. Populated in Phase 5.
 */
const messageSchema = new Schema(
  {
    direction: { type: String, enum: ["in", "out"], required: true },
    type: { type: String },
    body: { type: String },
    templateName: { type: String },
    waMessageId: { type: String },
    timestamp: { type: Date },
  },
  { _id: false },
);

const conversationSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    leadId: { type: Types.ObjectId, ref: "Lead" },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date },
    windowExpiresAt: { type: Date }, // 24-hour service window
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Section 5: { phone:1 } unique (declared inline). The spec also marks phone as
// an index; the unique index covers that.

export type ConversationDoc = InferSchemaType<typeof conversationSchema>;

export const Conversation: Model<ConversationDoc> =
  (models.Conversation as Model<ConversationDoc>) ??
  model<ConversationDoc>("Conversation", conversationSchema);

export default Conversation;
