"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";

/**
 * Interactive component demos for /design-system. Isolated into a client island
 * so the rest of the review page stays server-rendered.
 */
export function InteractiveDemos() {
  return (
    <div className="flex flex-wrap items-start gap-8">
      {/* Select */}
      <div className="flex w-64 flex-col gap-2">
        <span className="text-meta text-muted-foreground">
          Select (cascading dropdown)
        </span>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose a city" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Jharkhand</SelectLabel>
              <SelectItem value="ranchi">Ranchi</SelectItem>
              <SelectItem value="jamshedpur">Jamshedpur</SelectItem>
              <SelectItem value="dhanbad">Dhanbad</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Bihar</SelectLabel>
              <SelectItem value="patna">Patna</SelectItem>
              <SelectItem value="gaya">Gaya</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Dialog */}
      <div className="flex flex-col gap-2">
        <span className="text-meta text-muted-foreground">Dialog</span>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this listing?</DialogTitle>
              <DialogDescription>
                This soft-deletes the listing. Buyers will no longer see it, and its URL
                returns 410 Gone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="danger">Delete</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sheet */}
      <div className="flex flex-col gap-2">
        <span className="text-meta text-muted-foreground">Sheet (mobile filters)</span>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open sheet</Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>
                On mobile, filters live in a bottom/side sheet, never a blocking modal.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 px-5 py-4 text-sm text-muted-foreground">
              Filter controls go here.
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button block>Show 128 properties</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Toast */}
      <div className="flex flex-col gap-2">
        <span className="text-meta text-muted-foreground">Toast</span>
        <div className="flex flex-wrap gap-2">
          <Button variant="subtle" onClick={() => toast("Draft saved")}>
            Default
          </Button>
          <Button
            variant="subtle"
            onClick={() => toast.success("Listing submitted for review")}
          >
            Success
          </Button>
          <Button
            variant="subtle"
            onClick={() => toast.error("Upload failed - image under 1200px")}
          >
            Error
          </Button>
        </div>
      </div>
    </div>
  );
}
