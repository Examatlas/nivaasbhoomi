import { connectDB } from "@/lib/db/connect";
import { Setting } from "@/lib/db/models/Setting";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/settings/crypto";

/**
 * Automation (Zenith Code) settings (Phase-1 API-key connection).
 *
 * NivaasBhoomi uses Zenith Code as its WhatsApp aggregator + AI qualification
 * brain. The admin pastes the API key, base URL, optional account id, and the
 * signing secret Zenith uses when it pushes qualified leads to our ingest
 * endpoint. Secrets are encrypted at rest and NEVER returned to the browser -
 * the admin API returns only a masked preview.
 *
 * An env fallback is supported so a deploy can be pre-configured:
 *   ZENITH_API_KEY, ZENITH_BASE_URL, ZENITH_ACCOUNT_ID, ZENITH_INGEST_SECRET,
 *   MESSAGING_PROVIDER ("zenith" | "meta").
 */
const KEY = "automation";

export type MessagingProvider = "zenith" | "meta";

/** Full settings incl. decrypted secrets — SERVER ONLY (ingest, outbound). */
export interface AutomationSettings {
  provider: MessagingProvider;
  zenithApiKey: string;
  zenithBaseUrl: string;
  zenithAccountId: string;
  ingestSigningSecret: string;
}

/** Safe-to-render view for the admin UI: booleans + masked previews, no secrets. */
export interface AutomationSettingsView {
  provider: MessagingProvider;
  zenithBaseUrl: string;
  zenithAccountId: string;
  hasApiKey: boolean;
  hasIngestSecret: boolean;
  apiKeyPreview: string;
  ingestSecretPreview: string;
  /** True when values come from env rather than the DB (read-only in the UI). */
  fromEnv: { apiKey: boolean; ingestSecret: boolean };
}

interface StoredAutomation {
  provider?: MessagingProvider;
  zenithApiKeyEnc?: string;
  zenithBaseUrl?: string;
  zenithAccountId?: string;
  ingestSigningSecretEnc?: string;
}

async function readStored(): Promise<StoredAutomation> {
  await connectDB();
  const doc = await Setting.findOne({ key: KEY }).lean();
  return (doc?.value as StoredAutomation) ?? {};
}

/** Resolve full settings (DB, with env as fallback). Server-only. */
export async function getAutomationSettings(): Promise<AutomationSettings> {
  const stored = await readStored();
  const apiKey = stored.zenithApiKeyEnc
    ? safeDecrypt(stored.zenithApiKeyEnc)
    : (process.env.ZENITH_API_KEY ?? "");
  const ingestSecret = stored.ingestSigningSecretEnc
    ? safeDecrypt(stored.ingestSigningSecretEnc)
    : (process.env.ZENITH_INGEST_SECRET ?? "");
  const provider =
    stored.provider ?? (process.env.MESSAGING_PROVIDER as MessagingProvider) ?? "meta";
  return {
    provider: provider === "zenith" ? "zenith" : "meta",
    zenithApiKey: apiKey,
    zenithBaseUrl: stored.zenithBaseUrl ?? process.env.ZENITH_BASE_URL ?? "",
    zenithAccountId: stored.zenithAccountId ?? process.env.ZENITH_ACCOUNT_ID ?? "",
    ingestSigningSecret: ingestSecret,
  };
}

/** Masked view for the admin settings screen. */
export async function getAutomationSettingsView(): Promise<AutomationSettingsView> {
  const stored = await readStored();
  const apiKeyFromDb = Boolean(stored.zenithApiKeyEnc);
  const secretFromDb = Boolean(stored.ingestSigningSecretEnc);
  const apiKey = apiKeyFromDb
    ? safeDecrypt(stored.zenithApiKeyEnc!)
    : (process.env.ZENITH_API_KEY ?? "");
  const ingestSecret = secretFromDb
    ? safeDecrypt(stored.ingestSigningSecretEnc!)
    : (process.env.ZENITH_INGEST_SECRET ?? "");
  const provider =
    stored.provider ?? (process.env.MESSAGING_PROVIDER as MessagingProvider) ?? "meta";
  return {
    provider: provider === "zenith" ? "zenith" : "meta",
    zenithBaseUrl: stored.zenithBaseUrl ?? process.env.ZENITH_BASE_URL ?? "",
    zenithAccountId: stored.zenithAccountId ?? process.env.ZENITH_ACCOUNT_ID ?? "",
    hasApiKey: Boolean(apiKey),
    hasIngestSecret: Boolean(ingestSecret),
    apiKeyPreview: maskSecret(apiKey),
    ingestSecretPreview: maskSecret(ingestSecret),
    fromEnv: {
      apiKey: !apiKeyFromDb && Boolean(process.env.ZENITH_API_KEY),
      ingestSecret: !secretFromDb && Boolean(process.env.ZENITH_INGEST_SECRET),
    },
  };
}

export interface SaveAutomationInput {
  provider?: MessagingProvider;
  zenithBaseUrl?: string;
  zenithAccountId?: string;
  /** Only set when the admin enters a NEW value (blank = keep existing). */
  zenithApiKey?: string;
  ingestSigningSecret?: string;
}

/** Persist automation settings. Secrets are encrypted; blanks keep the current
 *  stored value so the admin doesn't have to re-enter them every save. */
export async function saveAutomationSettings(
  input: SaveAutomationInput,
  adminId: string,
): Promise<void> {
  await connectDB();
  const stored = await readStored();
  const next: StoredAutomation = { ...stored };

  if (input.provider) next.provider = input.provider === "zenith" ? "zenith" : "meta";
  if (input.zenithBaseUrl !== undefined) next.zenithBaseUrl = input.zenithBaseUrl.trim();
  if (input.zenithAccountId !== undefined) next.zenithAccountId = input.zenithAccountId.trim();
  if (input.zenithApiKey && input.zenithApiKey.trim()) {
    next.zenithApiKeyEnc = encryptSecret(input.zenithApiKey.trim());
  }
  if (input.ingestSigningSecret && input.ingestSigningSecret.trim()) {
    next.ingestSigningSecretEnc = encryptSecret(input.ingestSigningSecret.trim());
  }

  await Setting.updateOne(
    { key: KEY },
    { $set: { value: next, updatedBy: adminId } },
    { upsert: true },
  );
}

function safeDecrypt(payload: string): string {
  try {
    return decryptSecret(payload);
  } catch {
    return "";
  }
}
