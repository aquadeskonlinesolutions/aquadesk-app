import { getCurrentUser } from "@/lib/dal";
import { loadStaffPageData } from "./data";
import { StaffClient } from "./StaffClient";

export default async function StaffPage() {
  const user = await getCurrentUser();
  const isOwner = user.role === "owner";
  const data = await loadStaffPageData(user.diveCenterId, isOwner);

  return (
    <StaffClient
      diveCenterId={user.diveCenterId}
      isOwner={isOwner}
      roster={data.roster}
      certifications={data.certifications}
      unlinkedSecretaries={data.unlinkedSecretaries}
      crewTokenToday={data.crewTokenToday}
    />
  );
}
