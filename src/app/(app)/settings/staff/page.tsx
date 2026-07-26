import { requireOwner } from "@/lib/dal";
import { loadStaffPageData } from "./data";
import { StaffRosterSection } from "./StaffRosterSection";

export default async function SettingsStaffPage() {
  const user = await requireOwner();
  const data = await loadStaffPageData(user.diveCenterId);

  return (
    <StaffRosterSection
      roster={data.roster}
      certifications={data.certifications}
      unlinkedSecretaries={data.unlinkedSecretaries}
    />
  );
}
