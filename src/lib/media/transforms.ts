/**
 * Cloudinary transformation presets (DEV-SPEC.txt Section 14).
 *
 *   Card thumbnail: w_400,h_300,c_fill,g_auto,f_auto,q_auto
 *   Gallery:        w_1200,h_900,c_fill,g_auto,f_auto,q_auto
 *   OG image:       w_1200,h_630,c_fill,g_auto,f_auto
 *
 * These build delivery URLs from a stored publicId, so the same original is
 * served at the right size/format everywhere without re-uploading. Pure string
 * helpers - safe to use on the server or client.
 */

export const CLOUDINARY_TRANSFORMS = {
  cardThumb: "w_400,h_300,c_fill,g_auto,f_auto,q_auto",
  gallery: "w_1200,h_900,c_fill,g_auto,f_auto,q_auto",
  ogImage: "w_1200,h_630,c_fill,g_auto",
} as const;

export type CloudinaryPreset = keyof typeof CLOUDINARY_TRANSFORMS;

/** Cloud name from env. NEXT_PUBLIC_ mirror is optional; server var is source. */
function cloudName(): string {
  return (
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??
    process.env.CLOUDINARY_CLOUD_NAME ??
    ""
  );
}

/**
 * Build a delivery URL for a publicId at a given preset.
 *   cloudinaryUrl("listings/ranchi/kanke-road/abc", "cardThumb")
 *   -> https://res.cloudinary.com/<cloud>/image/upload/w_400,.../listings/.../abc
 */
export function cloudinaryUrl(
  publicId: string,
  preset: CloudinaryPreset = "gallery",
  cloud = cloudName(),
): string {
  const t = CLOUDINARY_TRANSFORMS[preset];
  return `https://res.cloudinary.com/${cloud}/image/upload/${t}/${publicId}`;
}

/** Slug-safe Cloudinary folder for a listing's photos (Section 14). */
export function listingFolder(citySlug: string, localitySlug: string): string {
  const safe = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "");
  return `listings/${safe(citySlug)}/${safe(localitySlug)}`;
}
