import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

import { slugify } from "@/lib/utils/slug";

/**
 * Blog (DEV-SPEC.txt Section 4). City-tagged content for SEO. slug is generated
 * from the title when not supplied, and publishedAt is stamped the first time a
 * post is published.
 */
const blogSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    content: { type: String }, // HTML
    excerpt: { type: String },
    coverImage: { type: String },
    cityId: { type: Types.ObjectId, ref: "City" }, // optional
    tags: { type: [String], default: [] },
    metaTitle: { type: String },
    metaDescription: { type: String },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    publishedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

blogSchema.pre("validate", function () {
  // Derive a slug from the title on first save if none was provided.
  if (!this.slug && this.title) {
    this.slug = slugify(this.title);
  }
  // Stamp publishedAt the first time the post goes live.
  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ cityId: 1 });
blogSchema.index({ tags: 1 });

export type BlogDoc = InferSchemaType<typeof blogSchema>;

export const Blog: Model<BlogDoc> =
  (models.Blog as Model<BlogDoc>) ?? model<BlogDoc>("Blog", blogSchema);

export default Blog;
