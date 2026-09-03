"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

/**
 * Mobile navigation. The only interactive island in the header, so the header
 * itself can stay a server component and ship almost no JS. Opens a right-side
 * Sheet - never a content-blocking modal.
 */
export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[86%] max-w-xs">
        <SheetHeader>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Logo />
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-3">
          {links.map((link) => (
            <SheetClose asChild key={link.href}>
              <Link
                href={link.href}
                className="rounded-control px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                {link.label}
              </Link>
            </SheetClose>
          ))}
        </nav>

        <SheetFooter>
          <SheetClose asChild>
            <Button asChild variant="primary" block size="lg">
              <Link href="/dealer/login">List your property</Link>
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
