import { requireOwner } from "@/lib/dal";
import { loadFleetData } from "./data";
import { BoatsSection } from "./BoatsSection";

export default async function SettingsFleetPage() {
  const user = await requireOwner();
  const data = await loadFleetData(user.diveCenterId);

  return (
    <div>
      <BoatsSection boats={data.boats} />
    </div>
  );
}
