"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export async function saveInsuranceSettings(offersInsurance: boolean, referralLink: string) {
  const user = await requireOwner();
  if (offersInsurance && !referralLink.trim()) {
    return { error: "Referral link is required when dive insurance is offered." };
  }
  const supabase = await createClient();

  const { error } = await supabase
    .from("dive_centers")
    .update({
      offers_dive_insurance: offersInsurance,
      insurance_referral_link: offersInsurance ? referralLink.trim() : null,
    })
    .eq("id", user.diveCenterId);
  if (error) return { error: error.message };

  revalidatePath("/settings/integrations");
  return { error: undefined };
}
