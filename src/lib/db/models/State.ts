import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * State - top of the location taxonomy (DEV-SPEC.txt Section 4).
 * Every City and Locality references a State. Seeded inactive; an admin flips
 * isActive when a state is launched.
 */
const stateSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    code: { type: String, required: true, trim: true }, // e.g. "JH"
    isActive: { type: Boolean, default: false },
    reraPortalUrl: { type: String }, // used during dealer RERA verification
    stampDutyRate: {
      // Phase 8 stamp-duty calculator; optional at seed time.
      male: { type: Number },
      female: { type: Number },
      joint: { type: Number },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// name and slug uniqueness is declared inline above (unique: true).

export type StateDoc = InferSchemaType<typeof stateSchema>;

// Reuse the compiled model across serverless invocations / HMR.
export const State: Model<StateDoc> =
  (models.State as Model<StateDoc>) ?? model<StateDoc>("State", stateSchema);

export default State;
