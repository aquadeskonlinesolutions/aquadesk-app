import { getCurrentUser } from "@/lib/dal";
import { loadBoatOptions, loadDiveSiteOptions, loadStaffOptions } from "./data";
import { SchedulingClient } from "./SchedulingClient";

export default async function SchedulingPage() {
  const user = await getCurrentUser();

  const [boats, diveSites, staffOptions] = await Promise.all([
    loadBoatOptions(user.diveCenterId),
    loadDiveSiteOptions(user.diveCenterId),
    loadStaffOptions(user.diveCenterId),
  ]);

  return <SchedulingClient boats={boats} diveSites={diveSites} staffOptions={staffOptions} />;
}
