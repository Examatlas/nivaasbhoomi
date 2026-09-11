/** A photo uploaded to Cloudinary, as stored on listing.photos (Section 4/14). */
export interface UploadedImage {
  url: string; // secure_url
  publicId: string;
  width: number;
  height: number;
  /** true when the (post-compression) image is below the low-res threshold.
   *  Shown ONLY to dealers/admins as a "Low resolution" tag — never to buyers. */
  isLowResolution?: boolean;
}

/** Signed params returned by POST /api/upload/signature. */
export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadUrl: string;
}

export const UPLOAD_RULES = {
  // Images whose SHORTER side is below this get a "Low resolution" tag (dealer/
  // admin only). It is NOT a gate — any image can still be uploaded.
  lowResBelow: 800,
  // Client-side compression target: resize the longest side down to maxDim and
  // encode JPEG at `quality`, stepping quality down until under targetBytes.
  compress: { maxDim: 1600, targetBytes: 500 * 1024, quality: 0.82 },
  // Generous sanity cap on the ORIGINAL file (we compress before upload, so a
  // dealer's multi-MB phone photo is fine). Guards against pathological inputs.
  maxBytes: 40 * 1024 * 1024,
  acceptedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  acceptAttr: "image/jpeg,image/png,image/webp",
} as const;

/** An image's shorter side is the fairest single "resolution" measure. */
export function isLowResolution(width: number, height: number): boolean {
  return Math.min(width, height) < UPLOAD_RULES.lowResBelow;
}
