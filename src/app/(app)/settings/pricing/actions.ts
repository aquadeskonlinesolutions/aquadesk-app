"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COURSES } from "./constants";

function ok() {
  revalidatePath("/settings/pricing");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

// ── PRICING MODE ────────────────────────────────────────────────────────

export async function confirmPricingMode(mode: "package" | "tier") {
  const user = await requireOwner();
  const supabase = await createClient();

  const { error } = await supabase
    .from("dive_centers")
    .update({ pricing_mode: mode })
    .eq("id", user.diveCenterId);
  if (error) return fail(error.message);

  if (mode === "tier") {
    const { data: existing } = await supabase
      .from("course_rates")
      .select("id")
      .eq("dive_center_id", user.diveCenterId)
      .limit(1);
    if (!existing || existing.length === 0) {
      await supabase.from("course_rates").insert(
        DEFAULT_COURSES.map((c) => ({
          dive_center_id: user.diveCenterId,
          course_name: c.name,
          rate: c.rate,
          is_active: true,
        })),
      );
    }
  }

  return ok();
}

export async function switchPricingMode(passwordAttempt: string) {
  const user = await requireOwner();
  const supabase = await createClient();

  const { data: dc } = await supabase
    .from("dive_centers")
    .select("pricing_mode, owner_unlock_hash")
    .eq("id", user.diveCenterId)
    .single();

  if (!dc?.owner_unlock_hash) {
    return fail("Set your owner password first, under Staff Access.");
  }

  const { data: verified, error: verifyError } = await supabase.rpc(
    "verify_owner_unlock",
    { p_dive_center_id: user.diveCenterId, p_attempt: passwordAttempt },
  );
  if (verifyError) return fail(verifyError.message);
  if (!verified) return fail("Incorrect owner password.");

  const { data: openBills } = await supabase
    .from("visits")
    .select("id")
    .eq("dive_center_id", user.diveCenterId)
    .eq("is_active", true)
    .eq("is_paid", false);
  if (openBills && openBills.length > 0) {
    return fail(
      `Cannot switch — ${openBills.length} open bill${openBills.length > 1 ? "s" : ""} must be closed first.`,
    );
  }

  const newMode = dc.pricing_mode === "package" ? "tier" : "package";
  const { error } = await supabase
    .from("dive_centers")
    .update({ pricing_mode: newMode })
    .eq("id", user.diveCenterId);
  if (error) return fail(error.message);

  return ok();
}

// ── COURSE RATES ─────────────────────────────────────────────────────────

export async function saveCourseRate(
  id: string | null,
  courseName: string,
  rate: number,
) {
  const user = await requireOwner();
  if (!courseName.trim()) return fail("Course name is required.");
  const supabase = await createClient();

  const payload = {
    dive_center_id: user.diveCenterId,
    course_name: courseName.trim(),
    rate,
    is_active: true,
  };
  const { error } = id
    ? await supabase.from("course_rates").update(payload).eq("id", id)
    : await supabase.from("course_rates").insert(payload);
  if (error) return fail(error.message);
  return ok();
}

export async function deleteCourseRate(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_rates")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// ── PACKAGES ─────────────────────────────────────────────────────────────

export async function savePackage(
  id: string | null,
  packageName: string,
  diveSite: string,
  price: number,
  equipmentIncluded: boolean,
) {
  const user = await requireOwner();
  if (!packageName.trim()) return fail("Package name is required.");
  if (!diveSite.trim()) return fail("Dive site combination is required.");
  const supabase = await createClient();

  const payload = {
    dive_center_id: user.diveCenterId,
    package_name: packageName.trim(),
    dive_site: diveSite.trim(),
    price,
    equipment_included: equipmentIncluded,
    is_active: true,
  };
  const { error } = id
    ? await supabase.from("packages").update(payload).eq("id", id)
    : await supabase.from("packages").insert(payload);
  if (error) return fail(error.message);
  return ok();
}

export async function deletePackage(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("packages")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// ── RATE TIERS ───────────────────────────────────────────────────────────

export type TierRowInput = {
  id: string | null;
  tierFrom: number;
  tierTo: number | null;
  baseRate: number;
};

export async function saveRateTiers(
  rateType: "base_dive" | "nitrox" | "tank_15l",
  rows: TierRowInput[],
) {
  const user = await requireOwner();
  const supabase = await createClient();

  for (const row of rows) {
    const payload = {
      dive_center_id: user.diveCenterId,
      rate_type: rateType,
      tier_from: row.tierFrom || 0,
      tier_to: row.tierTo,
      base_rate: row.baseRate || 0,
    };
    const { error } = row.id
      ? await supabase.from("rate_tiers").update(payload).eq("id", row.id)
      : await supabase.from("rate_tiers").insert(payload);
    if (error) return fail(error.message);
  }
  return ok();
}

export async function deleteRateTier(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("rate_tiers")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// ── OTHER CHARGES ────────────────────────────────────────────────────────

export async function saveDefaultCharge(
  chargeName: string,
  subType: string | null,
  amount: number,
  chargeType: "per_dive" | "per_day",
) {
  const user = await requireOwner();
  const supabase = await createClient();

  let query = supabase
    .from("other_charges")
    .select("id")
    .eq("dive_center_id", user.diveCenterId);
  query = subType
    ? query.eq("sub_type", subType)
    : query.eq("charge_name", chargeName).is("sub_type", null);
  const { data: existing } = await query.maybeSingle();

  const payload = {
    dive_center_id: user.diveCenterId,
    charge_name: chargeName,
    amount,
    charge_type: chargeType,
    sub_type: subType,
    is_active: true,
  };
  const { error } = existing
    ? await supabase.from("other_charges").update(payload).eq("id", existing.id)
    : await supabase.from("other_charges").insert(payload);
  if (error) return fail(error.message);
  return ok();
}

export async function addCustomCharge(
  chargeName: string,
  amount: number,
  chargeType: "per_dive" | "per_day",
) {
  const user = await requireOwner();
  if (!chargeName.trim()) return fail("Charge name is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("other_charges").insert({
    dive_center_id: user.diveCenterId,
    charge_name: chargeName.trim(),
    amount,
    charge_type: chargeType,
    is_active: true,
  });
  if (error) return fail(error.message);
  return ok();
}

export async function updateChargeAmount(id: string, amount: number) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("other_charges")
    .update({ amount })
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function deleteCharge(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("other_charges")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// ── EQUIPMENT RENTAL RATES ───────────────────────────────────────────────

export async function saveDefaultEquipmentRate(
  itemName: string,
  rate: number,
  chargeType: "per_dive" | "per_day",
) {
  const user = await requireOwner();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("equipment_rental_rates")
    .select("id")
    .eq("dive_center_id", user.diveCenterId)
    .eq("item_name", itemName)
    .maybeSingle();

  const payload = {
    dive_center_id: user.diveCenterId,
    item_name: itemName,
    rate,
    charge_type: chargeType,
    is_active: true,
  };
  const { error } = existing
    ? await supabase.from("equipment_rental_rates").update(payload).eq("id", existing.id)
    : await supabase.from("equipment_rental_rates").insert(payload);
  if (error) return fail(error.message);
  return ok();
}

export async function addCustomEquipmentRate(
  itemName: string,
  rate: number,
  chargeType: "per_dive" | "per_day",
) {
  const user = await requireOwner();
  if (!itemName.trim()) return fail("Equipment name is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("equipment_rental_rates").insert({
    dive_center_id: user.diveCenterId,
    item_name: itemName.trim(),
    rate,
    charge_type: chargeType,
    is_active: true,
  });
  if (error) return fail(error.message);
  return ok();
}

export async function updateEquipmentRateAmount(id: string, rate: number) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("equipment_rental_rates")
    .update({ rate })
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function deleteEquipmentRate(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("equipment_rental_rates")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// ── PAYMENT SURCHARGES ───────────────────────────────────────────────────

export async function saveSurcharges(cardPercent: number, onlinePercent: number) {
  const user = await requireOwner();
  const supabase = await createClient();

  for (const [type, percent] of [
    ["card", cardPercent],
    ["online", onlinePercent],
  ] as const) {
    const { data: existing } = await supabase
      .from("payment_surcharges")
      .select("id")
      .eq("dive_center_id", user.diveCenterId)
      .eq("surcharge_type", type)
      .maybeSingle();

    const payload = {
      dive_center_id: user.diveCenterId,
      surcharge_type: type,
      rate: percent / 100,
      is_active: true,
    };
    const { error } = existing
      ? await supabase.from("payment_surcharges").update(payload).eq("id", existing.id)
      : await supabase.from("payment_surcharges").insert(payload);
    if (error) return fail(error.message);
  }
  return ok();
}

// ── EXCHANGE RATES ───────────────────────────────────────────────────────

export type ExchangeRateInput = {
  currencyCode: string;
  rateToPhp: number;
  isActive: boolean;
};

export async function saveExchangeRates(rows: ExchangeRateInput[]) {
  const user = await requireOwner();
  const supabase = await createClient();

  for (const row of rows) {
    const { data: existing } = await supabase
      .from("exchange_rates")
      .select("id")
      .eq("dive_center_id", user.diveCenterId)
      .eq("currency_code", row.currencyCode)
      .maybeSingle();

    const payload = {
      dive_center_id: user.diveCenterId,
      currency_code: row.currencyCode,
      rate_to_php: row.rateToPhp,
      is_active: row.isActive,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("exchange_rates").update(payload).eq("id", existing.id)
      : await supabase.from("exchange_rates").insert(payload);
    if (error) return fail(error.message);
  }
  return ok();
}

export async function addCustomCurrency(currencyCode: string, rateToPhp: number) {
  const user = await requireOwner();
  const code = currencyCode.trim().toUpperCase();
  if (!code) return fail("Currency code is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("exchange_rates").insert({
    dive_center_id: user.diveCenterId,
    currency_code: code,
    rate_to_php: rateToPhp,
    is_active: true,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail(error.message);
  return ok();
}

// ── STAFF COMMISSION & JOIN RIDE RATES ──────────────────────────────────

export async function saveCommissionRates(
  divemasterRatePerDive: number,
  ratioBonusEnabled: boolean,
  ratioBonusExtraRate: number,
  joinRideRatePerDiverPerDive: number,
) {
  const user = await requireOwner();
  const supabase = await createClient();

  const { error } = await supabase
    .from("dive_centers")
    .update({
      divemaster_rate_per_dive: divemasterRatePerDive,
      ratio_bonus_enabled: ratioBonusEnabled,
      ratio_bonus_extra_rate: ratioBonusExtraRate,
      join_ride_rate_per_diver_per_dive: joinRideRatePerDiverPerDive,
    })
    .eq("id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}
