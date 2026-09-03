"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { UploadCloud, X, Star, GripVertical, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { uploadImage } from "@/lib/media/upload-client";
import { UPLOAD_RULES, type UploadedImage } from "@/types/media";

/**
 * Reusable direct-to-Cloudinary image uploader (DEV-SPEC.txt Section 14).
 *
 * Self-contained so both the admin listing form (next session) and the dealer
 * form (Phase 4) can drop it in. Validates type/size/min-width locally, uploads
 * each file straight to Cloudinary via a signed request, shows previews, allows
 * drag-to-reorder and cover selection, and reports the resulting
 * { url, publicId, width, height } list to the parent.
 *
 * State is fully controlled: the parent owns `value` (the photo list) and the
 * `coverIndex`; this component just calls onChange / onCoverChange.
 */
export interface ImageUploaderProps {
  /** Cloudinary folder, e.g. listings/ranchi/kanke-road. */
  folder: string;
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  coverIndex?: number;
  onCoverChange?: (index: number) => void;
  maxCount?: number;
  minCount?: number;
  disabled?: boolean;
}

export function ImageUploader({
  folder,
  value,
  onChange,
  coverIndex = 0,
  onCoverChange,
  maxCount = 15,
  minCount = 3,
  disabled = false,
}: ImageUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);

  const remaining = maxCount - value.length;

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    const allowed = list.slice(0, Math.max(0, remaining));
    if (list.length > allowed.length) {
      setErrors((e) => [...e, `You can add up to ${maxCount} photos.`]);
    }

    setUploadingCount((c) => c + allowed.length);
    const uploaded: UploadedImage[] = [];
    const newErrors: string[] = [];

    await Promise.all(
      allowed.map(async (file) => {
        try {
          uploaded.push(await uploadImage(file, folder));
        } catch (err) {
          newErrors.push(err instanceof Error ? err.message : "Upload failed.");
        } finally {
          setUploadingCount((c) => c - 1);
        }
      }),
    );

    if (uploaded.length) onChange([...value, ...uploaded]);
    if (newErrors.length) setErrors((e) => [...e, ...newErrors]);
  }

  function removeAt(index: number) {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    // Keep the cover pointing at a valid, intuitive item.
    if (onCoverChange) {
      if (index === coverIndex) onCoverChange(0);
      else if (index < coverIndex) onCoverChange(Math.max(0, coverIndex - 1));
    }
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    onChange(next);

    if (onCoverChange) {
      // The cover follows its item to the new position.
      if (coverIndex === from) onCoverChange(to);
      else if (from < coverIndex && to >= coverIndex) onCoverChange(coverIndex - 1);
      else if (from > coverIndex && to <= coverIndex) onCoverChange(coverIndex + 1);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Dropzone */}
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-8 text-center transition-colors",
          dragOver
            ? "border-ink-400 bg-ink-50"
            : "border-border-strong bg-surface-muted/40",
          (disabled || remaining <= 0) && "pointer-events-none opacity-50",
        )}
      >
        <UploadCloud className="size-7 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Drag photos here, or click to upload
          </p>
          <p className="mt-0.5 text-meta text-muted-foreground">
            JPG, PNG or WebP · min {UPLOAD_RULES.minWidth}px wide · up to 5 MB ·{" "}
            {value.length}/{maxCount} added
          </p>
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={UPLOAD_RULES.acceptAttr}
          multiple
          hidden
          disabled={disabled || remaining <= 0}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {value.length > 0 && value.length < minCount && (
        <p className="text-meta text-warning-700">
          Add at least {minCount} photos before submitting.
        </p>
      )}

      {errors.length > 0 && (
        <div className="flex flex-col gap-1 rounded-control border border-danger-100 bg-danger-50 p-3">
          {errors.map((msg, i) => (
            <p key={i} className="text-meta text-danger-700">
              {msg}
            </p>
          ))}
          <button
            type="button"
            onClick={() => setErrors([])}
            className="self-start text-meta font-medium text-danger-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Previews */}
      {(value.length > 0 || uploadingCount > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {value.map((img, index) => {
            const isCover = index === coverIndex;
            return (
              <li
                key={img.publicId}
                draggable={!disabled}
                onDragStart={() => (dragIndex.current = index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex.current !== null) reorder(dragIndex.current, index);
                  dragIndex.current = null;
                }}
                className={cn(
                  "group relative aspect-[4/3] overflow-hidden rounded-media border bg-sand-200",
                  isCover ? "border-ink-500 ring-2 ring-ink-500/30" : "border-border",
                )}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  className="object-cover"
                />

                {/* drag handle */}
                <span className="absolute top-1.5 left-1.5 rounded-md bg-ink-950/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <GripVertical className="size-3.5" />
                </span>

                {isCover && (
                  <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-ink-900 px-2 py-0.5 text-overline font-semibold text-white">
                    <Star className="size-3 fill-current" /> Cover
                  </span>
                )}

                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!isCover && onCoverChange && (
                    <button
                      type="button"
                      onClick={() => onCoverChange(index)}
                      aria-label="Set as cover"
                      className="rounded-md bg-surface/90 p-1 text-ink-700 shadow-subtle hover:bg-surface"
                    >
                      <Star className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    aria-label="Remove photo"
                    className="rounded-md bg-surface/90 p-1 text-danger-600 shadow-subtle hover:bg-surface"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}

          {Array.from({ length: uploadingCount }).map((_, i) => (
            <li
              key={`uploading-${i}`}
              className="flex aspect-[4/3] items-center justify-center rounded-media border border-border bg-surface-muted"
            >
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
