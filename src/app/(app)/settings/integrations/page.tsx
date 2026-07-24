import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { InsuranceSection } from "./InsuranceSection";

export default async function SettingsIntegrationsPage() {
  const user = await requireOwner();
  const supabase = await createClient();

  const { data: dc } = await supabase
    .from("dive_centers")
    .select("offers_dive_insurance, insurance_referral_link")
    .eq("id", user.diveCenterId)
    .single();

  return (
    <div>
      <InsuranceSection
        offersInsurance={dc?.offers_dive_insurance ?? false}
        referralLink={dc?.insurance_referral_link ?? null}
      />
    </div>
  );
}
