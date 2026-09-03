import type { Metadata } from "next";
import { LocationManager } from "@/components/admin/location-manager";

export const metadata: Metadata = {
  title: "Location Manager",
  robots: { index: false, follow: false },
};

/**
 * Admin location manager (DEV-SPEC.txt Section 15). Browse/search states,
 * cities and localities; approve or reject dealer locality requests; drill into
 * a city to check activation or a locality to edit content. All data is fetched
 * server-paginated by the client panels - nothing loads the full 162k set.
 */
export default function AdminLocationsPage() {
  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-display-sm">Locations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the India location tree, approve dealer-requested localities, and
          activate cities once they meet the launch guard.
        </p>
      </header>
      <LocationManager />
    </div>
  );
}
