"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Upload, Loader2, Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/shared/image-uploader";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import {
  validateRegId,
  normalizeRegId,
  RERA_HELP,
  type RegIdKind,
} from "@/lib/validation/registration-ids";
import type { UploadedImage } from "@/types/media";
import type { DocStatus } from "@/lib/dealers/account";

interface Opt {
  _id: string;
  name: string;
}

/**
 * One verification document (DEV-SPEC.txt S4/S13). The dealer uploads the file
 * (direct to Cloudinary) plus any number/state, then Saves - which stores the
 * url on their record with verified=false. An admin verifies later; the dealer
 * only ever sees "uploaded / pending / verified", never sets verified.
 */
export function DocumentUploader({
  dealerId,
  doc,
}: {
  dealerId: string;
  doc: DocStatus;
}) {
  const hasNumber = doc.key === "gst" || doc.key === "udyam" || doc.key === "rera";
  const isRera = doc.key === "rera";

  const [image, setImage] = useState<UploadedImage[]>([]);
  const [number, setNumber] = useState(doc.number ?? "");
  const [stateId, setStateId] = useState(doc.stateId ?? "");
  const [states, setStates] = useState<Opt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const numberError = hasNumber && number ? validateRegId(doc.key as RegIdKind, number) : null;

  useEffect(() => {
    if (!isRera) return;
    apiFetch<Opt[]>("/api/locations/states")
      .then(setStates)
      .catch(() => setStates([]));
  }, [isRera]);

  async function save() {
    setError(null);
    const url = image[0]?.url;
    if (!url) {
      setError("Please upload the document image first.");
      return;
    }
    if (isRera && !stateId) {
      setError("Select the RERA state.");
      return;
    }
    if (numberError) {
      setError(numberError);
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/dealers/${dealerId}/documents`, {
        method: "POST",
        body: JSON.stringify({
          type: doc.key,
          url,
          ...(hasNumber && number ? { number } : {}),
          ...(isRera && stateId ? { stateId } : {}),
        }),
      });
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const uploaded = doc.uploaded || justSaved;

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-ink-950">{doc.label}</h3>
        {doc.mandatory && (
          <span className="rounded-full bg-clay-50 px-2 py-0.5 text-overline font-semibold text-clay-700 uppercase">
            Required
          </span>
        )}
        <div className="ml-auto">
          {doc.verified ? (
            <span className="inline-flex items-center gap-1 text-meta font-medium text-success-700">
              <CheckCircle2 className="size-4" /> Verified
            </span>
          ) : uploaded ? (
            <span className="inline-flex items-center gap-1 text-meta font-medium text-warning-700">
              <Clock className="size-4" /> Pending review
            </span>
          ) : (
            <span className="text-meta text-muted-foreground">Not uploaded</span>
          )}
        </div>
      </div>

      {/* A verified document is locked - re-uploading would reset verification. */}
      {doc.verified ? (
        <p className="mt-2 text-meta text-muted-foreground">
          This document has been verified.
          {doc.number ? ` No. ${doc.number}.` : ""}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {hasNumber && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{doc.label} number</Label>
                <Input
                  value={number}
                  onChange={(e) => {
                    setNumber(normalizeRegId(e.target.value));
                    setJustSaved(false);
                  }}
                  invalid={Boolean(numberError)}
                  placeholder={
                    doc.key === "gst"
                      ? "22AAAAA0000A1Z5"
                      : doc.key === "udyam"
                        ? "UDYAM-XX-00-0000000"
                        : "As issued by your state"
                  }
                />
                {numberError && <p className="text-meta text-danger-700">{numberError}</p>}
                {isRera && <p className="text-meta text-muted-foreground">{RERA_HELP}</p>}
              </div>
              {isRera && (
                <div className="flex flex-col gap-1.5">
                  <Label required>RERA state</Label>
                  <Select value={stateId || undefined} onValueChange={setStateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <ImageUploader
            folder="dealers"
            value={image}
            onChange={(imgs) => {
              setImage(imgs);
              setJustSaved(false);
            }}
            maxCount={1}
            minCount={0}
          />

          {error && <p className="text-meta text-danger-700">{error}</p>}
          {justSaved && (
            <p className="inline-flex items-center gap-1.5 text-meta font-medium text-success-700">
              <Check className="size-4" /> Saved. Sent for review.
            </p>
          )}

          <div>
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploaded ? "Replace document" : "Upload document"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
