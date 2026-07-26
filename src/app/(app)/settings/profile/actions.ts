"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(input: {
  name: string;
  email: string;
  phone: string;
  address: string;
  logoUrl: string | null;
}) {
  const user = await requireOwner();

  const name = input.name.trim();
  if (!name) return { error: "Dive center name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dive_centers")
    .update({
      name,
      email: input.email.trim() || null,
      phone: input.phone.trim() || null,
      address: input.address.trim() || null,
      logo_url: input.logoUrl,
    })
    .eq("id", user.diveCenterId);

  if (error) return { error: error.message };

  revalidatePath("/settings/profile");
  return {};
}

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

  revalidatePath("/settings/profile");
  return { error: undefined };
}
