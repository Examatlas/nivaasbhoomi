"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DealerRegistrationForm } from "@/components/dealer/dealer-registration-form";

/** Buyer → dealer upgrade: a confirm step, then the SHARED registration form.
 *  Name and phone are prefilled from the buyer account; phone is not editable. */
export function BecomeDealerFlow({ name, phone }: { name: string; phone: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"confirm" | "form">("confirm");

  if (step === "confirm") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-clay-50 text-clay-700">
          <Store className="size-6" />
        </span>
        <div>
          <h1 className="text-display-sm">Become a dealer</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This number is already registered as a buyer account. Would you like to upgrade it to a
            dealer account and list your properties?
          </p>
        </div>
        <div className="mt-2 flex gap-3">
          <Button variant="ghost" onClick={() => router.push("/")}>
            Cancel
          </Button>
          <Button onClick={() => setStep("form")}>
            Continue <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return <DealerRegistrationForm name={name} phone={phone} />;
}
