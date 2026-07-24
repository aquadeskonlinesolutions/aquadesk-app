import { requireOwner } from "@/lib/dal";
import { loadStaffAccessData } from "./data";
import { SecretaryAccountsSection } from "./SecretaryAccountsSection";
import { PasswordSection } from "./PasswordSection";
import { WarningBox, InfoBox } from "@/components/settings/SettingsSection";
import { setOwnerPassword, setBillingPassword } from "./actions";

export default async function SettingsStaffAccessPage() {
  const user = await requireOwner();
  const data = await loadStaffAccessData(user.diveCenterId);

  return (
    <div>
      <SecretaryAccountsSection secretaries={data.secretaries} />

      <PasswordSection
        title="Billing Password"
        subtitle="Used by owner and secretary to mark bills as paid or unlock paid bills"
        notice={
          <InfoBox>
            ℹ️ Share this password with your secretaries. They will need it
            to mark bills as paid and to unlock paid bills for editing.
          </InfoBox>
        }
        hasPassword={data.hasBillingPassword}
        saveAction={setBillingPassword}
      />

      <PasswordSection
        title="Owner Password"
        subtitle="Used only to switch pricing mode — keep this private"
        notice={
          <WarningBox>
            ⚠️ Keep this password private. It is required to switch your
            pricing mode between Package and Tier. Do not share with
            secretaries or staff.
          </WarningBox>
        }
        hasPassword={data.hasOwnerPassword}
        saveAction={setOwnerPassword}
      />
    </div>
  );
}
