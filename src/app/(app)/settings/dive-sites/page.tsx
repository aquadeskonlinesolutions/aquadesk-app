import { requireOwner } from "@/lib/dal";
import { loadDiveSitesData } from "./data";
import { DiveSitesSection } from "./DiveSitesSection";
import { TripTypesSection } from "./TripTypesSection";

export default async function SettingsDiveSitesPage() {
  const user = await requireOwner();
  const data = await loadDiveSitesData(user.diveCenterId);

  return (
    <div className="grid gap-6">
      <DiveSitesSection
        sites={data.diveSites}
        packages={data.packages}
        pricingMode={data.pricingMode}
      />
      <TripTypesSection tripTypes={data.tripTypes} />
    </div>
  );
}
