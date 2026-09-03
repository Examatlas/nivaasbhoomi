import { apiFetch } from "@/lib/api/client";
import { UPLOAD_RULES, type SignedUpload, type UploadedImage } from "@/types/media";

/**
 * Browser-side helpers for the direct-to-Cloudinary upload flow (Section 14).
 * The file is validated locally, then sent straight to Cloudinary using a
 * server-signed set of params - it never passes through our own server.
 */

export interface ValidationResult {
  ok: boolean;
  width?: number;
  height?: number;
  error?: string;
}

/** Read a file's pixel dimensions in the browser. */
function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image."));
    };
    img.src = url;
  });
}

/** Enforce the Section 14 rules: type, size, and minimum width, before upload. */
export async function validateImage(file: File): Promise<ValidationResult> {
  if (!UPLOAD_RULES.acceptedTypes.includes(file.type as never)) {
    return { ok: false, error: "Only JPG, PNG or WebP images are allowed." };
  }
  if (file.size > UPLOAD_RULES.maxBytes) {
    return { ok: false, error: "Image is larger than 5 MB." };
  }
  let dims: { width: number; height: number };
  try {
    dims = await readDimensions(file);
  } catch {
    return { ok: false, error: "That file is not a readable image." };
  }
  if (dims.width < UPLOAD_RULES.minWidth) {
    return {
      ok: false,
      width: dims.width,
      height: dims.height,
      error: `Image must be at least ${UPLOAD_RULES.minWidth}px wide (this is ${dims.width}px).`,
    };
  }
  return { ok: true, ...dims };
}

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
}

/**
 * Validate, get a signature, and upload one file directly to Cloudinary.
 * Returns the stored image descriptor, or throws with a user-facing message.
 */
export async function uploadImage(file: File, folder: string): Promise<UploadedImage> {
  const check = await validateImage(file);
  if (!check.ok) throw new Error(check.error ?? "Invalid image.");

  const signed = await apiFetch<SignedUpload>("/api/upload/signature", {
    method: "POST",
    body: JSON.stringify({ folder, resourceType: "image" }),
  });

  const form = new FormData();
  form.append("file", file);
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
      // keep the generic message
    }
    throw new Error(message);
  }

  const data = (await res.json()) as CloudinaryUploadResponse;
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
  };
}
