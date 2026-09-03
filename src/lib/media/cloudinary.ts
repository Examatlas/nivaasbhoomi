import { v2 as cloudinary } from "cloudinary";

/**
 * Server-side Cloudinary signing (DEV-SPEC.txt Section 14).
 *
 * We only ever SIGN uploads here - the file itself goes directly from the client
 * to Cloudinary and never through our server ("Never proxy the file through your
 * server"). The api_secret stays server-side; the client receives a short-lived
 * signature plus the public cloud name and api key.
 */

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      "Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET).",
    );
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
}

export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  /** Endpoint the client POSTs the file to. */
  uploadUrl: string;
}

/**
 * Produce the signed parameters for a direct client upload. The signature covers
 * exactly the params the client will send (folder + timestamp), so the client
 * cannot upload to a different folder than we authorised.
 */
export function signUpload(
  folder: string,
  resourceType: "image" | "video",
): SignedUpload {
  ensureConfigured();

  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME!;
  const api_key = process.env.CLOUDINARY_API_KEY!;
  const api_secret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, api_secret);

  return {
    cloudName: cloud_name,
    apiKey: api_key,
    timestamp,
    signature,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`,
  };
}
