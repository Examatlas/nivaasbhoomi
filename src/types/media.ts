/** A photo uploaded to Cloudinary, as stored on listing.photos (Section 4/14). */
export interface UploadedImage {
  url: string; // secure_url
  publicId: string;
  width: number;
  height: number;
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
  minWidth: 1200,
  maxBytes: 5 * 1024 * 1024, // 5MB
  acceptedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  acceptAttr: "image/jpeg,image/png,image/webp",
} as const;
