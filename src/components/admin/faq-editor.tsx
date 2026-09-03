"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FaqItem } from "@/types/admin-locations";

/** Small controlled FAQ list editor used on city and locality detail screens. */
export function FaqEditor({
  value,
  onChange,
}: {
  value: FaqItem[];
  onChange: (next: FaqItem[]) => void;
}) {
  const update = (i: number, patch: Partial<FaqItem>) =>
    onChange(value.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { question: "", answer: "" }]);

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 && (
        <p className="text-meta text-muted-foreground">No FAQ entries yet.</p>
      )}
      {value.map((item, i) => (
        <div
          key={i}
          className="rounded-control border border-border bg-surface-muted/40 p-3"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <Input
                value={item.question}
                onChange={(e) => update(i, { question: e.target.value })}
                placeholder="Question"
              />
              <Textarea
                value={item.answer}
                onChange={(e) => update(i, { answer: e.target.value })}
                placeholder="Answer"
                rows={2}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              aria-label="Remove FAQ entry"
            >
              <Trash2 className="text-danger-600" />
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button variant="outline" size="sm" onClick={add}>
          <Plus /> Add FAQ
        </Button>
      </div>
    </div>
  );
}
