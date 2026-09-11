import { apiFetch } from "@/lib/api/client";
import { UPLOAD_RULES, isLowResolution, type SignedUpload, type UploadedImage } from "@/types/media";
import { compressImage } from "@/lib/media/compress";

/**
 * Browser-side helpers for the direct-to-Cloudinary upload flow (Section 14).
 * The file is validated locally, COMPRESSED in the browser (resize + JPEG), then
 * sent straight to Cloudinary using a server-signed set of params — it never
 * passes through our own server.
 *
 * There is NO minimum-resolution gate: any readable image uploads. A
 * low-resolution image is merely TAGGED (isLowResolution) for the dealer/admin.
 */

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Type + generous size check only (compression handles large phone photos). */
export function validateImage(file: File): ValidationResult {
  if (!UPLOAD_RULES.acceptedTypes.includes(file.type as never)) {
    return { ok: false, error: "Only JPG, PNG or WebP images are allowed." };
  }
  if (file.size > UPLOAD_RULES.maxBytes) {
    return { ok: false, error: "That image is unusually large. Please pick another photo." };
  }
  return { ok: true };
}

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
}

export type UploadPhase = "compressing" | "uploading";

/**
 * Validate, compress, sign, and upload one file directly to Cloudinary.
 * `onPhase` reports progress so the UI never looks stuck. Returns the stored
 * image descriptor (incl. an isLowResolution tag), or throws a user-facing error.
 */
export async function uploadImage(
  file: File,
  folder: string,
  onPhase?: (phase: UploadPhase) => void,
): Promise<UploadedImage> {
  const check = validateImage(file);
  if (!check.ok) throw new Error(check.error ?? "Invalid image.");

  onPhase?.("compressing");
  const { file: toUpload } = await compressImage(file);

  onPhase?.("uploading");
  const signed = await apiFetch<SignedUpload>("/api/upload/signature", {
    method: "POST",
    body: JSON.stringify({ folder, resourceType: "image" }),
  });

  const form = new FormData();
  form.append("file", toUpload);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("folder", signed.folder);

  const res = await fetch(signed.uploadUrl, { method: "POST", body: form });
  if (!res.ok) {
    let message = "Upload to Cloudinary failed.";
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      if (err.error?.message) message = err.error.message;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }

  const data = (await res.json()) as CloudinaryUploadResponse;
  // Cloudinary returns the stored (compressed) dimensions — the source of truth.
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    isLowResolution: isLowResolution(data.width, data.height),
  };
}
