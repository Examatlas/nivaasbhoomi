import type { Metadata } from "next";
import { CityDetailView } from "@/components/admin/city-detail-view";

export const metadata: Metadata = {
  title: "City",
  robots: { index: false, follow: false },
};

export default async function AdminCityDetailPage({
  params,
}: PageProps<"/admin/locations/cities/[id]">) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <CityDetailView id={id} />
    </div>
  );
}
