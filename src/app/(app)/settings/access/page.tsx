import { requireOwner } from "@/lib/dal";
import { loadAccessData } from "./data";
import { SecretaryAccountsSection } from "./SecretaryAccountsSection";

export default async function SettingsAccessPage() {
  const user = await requireOwner();
  const data = await loadAccessData(user.diveCenterId);

  return (
    <div>
      <SecretaryAccountsSection secretaries={data.secretaries} />
    </div>
  );
}
