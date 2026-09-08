import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * Audit trail (DEV-SPEC.txt Section 16: "Log every lead assignment"). An
 * append-only record of every consequential lead action - automatic routing,
 * admin manual assignment, and the admin override-reassignment that is the one
 * sanctioned exception to the exclusivity lock. Nothing here is ever mutated.
 */
const auditLogSchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        "lead.auto-assign", // routing engine assigned it
        "lead.admin-assign", // admin placed an unmatched lead
        "lead.admin-override-reassign", // admin moved a locked lead
        "lead.status-change", // dealer/admin changed status
        "dealer.admin-convert", // admin converted a User into a Dealer (STEP 2)
        "dealer.quota-adjust", // admin changed a dealer's monthly quota (STEP 3)
      ],
      required: true,
      index: true,
    },
    actorType: { type: String, enum: ["system", "admin", "dealer"], required: true },
    actorId: { type: String }, // adminEmail / dealerId / "routing"
    leadId: { type: Types.ObjectId, ref: "Lead", index: true },
    dealerId: { type: Types.ObjectId, ref: "Dealer" }, // new/target dealer
    prevDealerId: { type: Types.ObjectId, ref: "Dealer" }, // for reassignment
    reason: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

auditLogSchema.index({ leadId: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) ??
  model<AuditLogDoc>("AuditLog", auditLogSchema);

export default AuditLog;
