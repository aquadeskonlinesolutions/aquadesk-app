import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "./ProfileClient";
import { InsuranceSection } from "./InsuranceSection";

export default async function SettingsProfilePage() {
  const user = await requireOwner();
  const supabase = await createClient();

  const { data: dc } = await supabase
    .from("dive_centers")
    .select(
      "name, email, phone, address, logo_url, subscription_status, offers_dive_insurance, insurance_referral_link",
    )
    .eq("id", user.diveCenterId)
    .single();

  return (
    <div>
      <ProfileClient
        diveCenterId={user.diveCenterId}
        name={dc?.name ?? ""}
        email={dc?.email ?? ""}
        phone={dc?.phone ?? ""}
        address={dc?.address ?? ""}
        logoUrl={dc?.logo_url ?? null}
        subscriptionStatus={dc?.subscription_status ?? "trial"}
      />
      <InsuranceSection
        offersInsurance={dc?.offers_dive_insurance ?? false}
        referralLink={dc?.insurance_referral_link ?? null}
      />
    </div>
  );
}
