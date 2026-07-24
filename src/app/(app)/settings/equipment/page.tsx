import { requireOwner } from "@/lib/dal";
import { loadEquipmentData } from "./data";
import { BoatsSection } from "./BoatsSection";
import { DiveSitesSection } from "./DiveSitesSection";
import { TanksSection } from "./TanksSection";
import { FuelSection } from "./FuelSection";
import { GearSection } from "./GearSection";

export default async function SettingsEquipmentPage() {
  const user = await requireOwner();
  const data = await loadEquipmentData(user.diveCenterId);

  return (
    <div>
      <BoatsSection boats={data.boats} />
      <DiveSitesSection
        sites={data.diveSites}
        packages={data.packages}
        pricingMode={data.pricingMode}
      />
      <TanksSection tanks={data.tanks} />
      <FuelSection fuel={data.fuel} />
      <GearSection gear={data.gear} />
    </div>
  );
}
