import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Key-value settings store (Phase-1 automation config). A single document per
 * key. Secret values are stored ENCRYPTED (AES-256-GCM, see lib/settings/crypto)
 * - never in plain text - and are never returned to the client unmasked.
 *
 * The automation settings live under key "automation".
 */
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

export type SettingDoc = InferSchemaType<typeof settingSchema>;

export const Setting: Model<SettingDoc> =
  (models.Setting as Model<SettingDoc>) ?? model<SettingDoc>("Setting", settingSchema);

export default Setting;
