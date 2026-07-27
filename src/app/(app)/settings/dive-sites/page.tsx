import { requireOwner } from "@/lib/dal";
import { loadDiveSitesData } from "./data";
import { DiveSitesSection } from "./DiveSitesSection";

export default async function SettingsDiveSitesPage() {
  const user = await requireOwner();
  const data = await loadDiveSitesData(user.diveCenterId);

  return (
    <div>
      <DiveSitesSection
        sites={data.diveSites}
        packages={data.packages}
        pricingMode={data.pricingMode}
      />
    </div>
  );
}
