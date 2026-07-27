import { requireOwner } from "@/lib/dal";
import { loadInventoryData } from "./data";
import { TanksSection } from "./TanksSection";
import { FuelSection } from "./FuelSection";
import { GearSection } from "./GearSection";

export default async function SettingsInventoryPage() {
  const user = await requireOwner();
  const data = await loadInventoryData(user.diveCenterId);

  return (
    <div>
      <TanksSection tanks={data.tanks} />
      <FuelSection fuel={data.fuel} />
      <GearSection gear={data.gear} />
    </div>
  );
}
