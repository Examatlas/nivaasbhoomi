import type { Metadata } from "next";
import { LocalityDetailView } from "@/components/admin/locality-detail-view";

export const metadata: Metadata = {
  title: "Locality",
  robots: { index: false, follow: false },
};

export default async function AdminLocalityDetailPage({
  params,
}: PageProps<"/admin/locations/localities/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <LocalityDetailView id={id} />
    </div>
  );
}
