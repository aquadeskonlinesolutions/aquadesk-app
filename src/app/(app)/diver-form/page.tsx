import { getCurrentUser } from "@/lib/dal";
import { loadRecentDivers } from "./data";
import { DiversListClient } from "./DiversListClient";

export default async function DiversPage() {
  const user = await getCurrentUser();
  const initialDivers = await loadRecentDivers(user.diveCenterId);

  return <DiversListClient diveCenterId={user.diveCenterId} initialDivers={initialDivers} />;
}
