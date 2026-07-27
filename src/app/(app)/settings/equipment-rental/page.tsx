import { requireOwner } from "@/lib/dal";
import { loadEquipmentRentalData } from "./data";
import { EquipmentRentalSection } from "./EquipmentRentalSection";

export default async function SettingsEquipmentRentalPage() {
  const user = await requireOwner();
  const data = await loadEquipmentRentalData(user.diveCenterId);

  return (
    <div>
      <EquipmentRentalSection rates={data.equipmentRentalRates} />
    </div>
  );
}
