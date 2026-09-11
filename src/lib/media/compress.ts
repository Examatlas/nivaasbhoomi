import { UPLOAD_RULES } from "@/types/media";

/**
 * Browser-side image compression (Part 1). Before a photo is uploaded we resize
 * it to at most `maxDim` on the longest side and re-encode it as JPEG, stepping
 * quality down until it is under `targetBytes`. This turns a dealer's 5–12 MB
 * phone photo into a ~500 KB upload automatically — the biggest source of upload
 * friction — while preserving aspect ratio and applying EXIF orientation.
 *
 * It never UPSCALES (a small photo stays small, so it can still be flagged
 * low-resolution). If anything fails, it returns the original file untouched —
 * compression must never block an upload.
 */

const { maxDim, targetBytes, quality } = UPLOAD_RULES.compress;
const QUALITY_STEPS = [quality, 0.72, 0.62, 0.5];

/** Decode a file to an orientation-corrected bitmap (EXIF handled by the browser). */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // `imageOrientation: "from-image"` bakes EXIF rotation into the pixels.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, q: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
}

export interface CompressResult {
  file: File;
  width: number;
  height: number;
  /** true if we actually re-encoded (false when we returned the original). */
  compressed: boolean;
}

/**
 * Compress one image file. Returns the (possibly new) file plus its final pixel
 * dimensions. Falls back to the original on any error or if the result isn't
 * actually smaller.
 */
export async function compressImage(file: File): Promise<CompressResult> {
  // Non-raster or tiny files: nothing to gain — skip.
  if (!file.type.startsWith("image/")) return fallback(file);
  try {
    const bitmap = await decode(file);
    const srcW = "width" in bitmap ? bitmap.width : (bitmap as HTMLImageElement).naturalWidth;
    const srcH = "height" in bitmap ? bitmap.height : (bitmap as HTMLImageElement).naturalHeight;
    if (!srcW || !srcH) return fallback(file);

    const scale = Math.min(1, maxDim / Math.max(srcW, srcH)); // never upscale
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback(file);
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    let blob: Blob | null = null;
    for (const q of QUALITY_STEPS) {
      blob = await toBlob(canvas, q);
      if (blob && blob.size <= targetBytes) break;
    }
    if (!blob) return fallback(file, w, h);

    // If we didn't actually shrink the bytes (already-small original), keep the
    // original file but report the (possibly downscaled) dimensions we measured.
    if (blob.size >= file.size && scale === 1) return fallback(file, srcW, srcH);

    const name = file.name.replace(/\.\w+$/, "") + ".jpg";
    return { file: new File([blob], name, { type: "image/jpeg" }), width: w, height: h, compressed: true };
  } catch {
    return fallback(file);
  }
}

function fallback(file: File, width = 0, height = 0): CompressResult {
  return { file, width, height, compressed: false };
}
