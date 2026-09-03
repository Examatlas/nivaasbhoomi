import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, withErrorHandling } from "@/lib/api/response";
import { requireUploader } from "@/lib/auth/middleware";
import { signUpload } from "@/lib/media/cloudinary";

/**
 * POST /api/upload/signature   [auth]   (DEV-SPEC.txt Sections 7, 14)
 *   body: { folder, resourceType }
 *   -> returns signed params; the client then uploads DIRECTLY to Cloudinary.
 *
 * The folder is constrained to `listings/<citySlug>/<localitySlug>` (or a
 * top-level `listings`/`dealers` area) with slug-safe segments, so a caller can
 * never sign an upload into an arbitrary path.
 */
const FOLDER_RE = /^(listings|dealers)(\/[a-z0-9][a-z0-9-]*){0,3}$/;

const bodySchema = z.object({
  folder: z.string().trim().min(1).max(200).regex(FOLDER_RE, "Invalid upload folder."),
  resourceType: z.enum(["image", "video"]).default("image"),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireUploader();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Invalid upload request.", parsed.error.flatten());
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return fail(
      "SERVER_ERROR",
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET in .env.local.",
    );
  }

  const signed = signUpload(parsed.data.folder, parsed.data.resourceType);
  return ok(signed);
});
