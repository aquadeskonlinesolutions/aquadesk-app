import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PricingMode = "package" | "tier" | null;

export type CourseRate = {
  id: string;
  course_name: string;
  rate: number;
  is_active: boolean;
};

export type Package = {
  id: string;
  package_name: string;
  dive_site: string | null;
  price: number;
  equipment_included: boolean;
  is_active: boolean;
};

export type RateTier = {
  id: string;
  rate_type: "base_dive" | "nitrox" | "tank_15l";
  tier_from: number;
  tier_to: number | null;
  base_rate: number;
};

export type OtherCharge = {
  id: string;
  charge_name: string;
  amount: number;
  charge_type: "per_dive" | "per_day";
  sub_type: string | null;
  is_active: boolean;
};

export type EquipmentRentalRate = {
  id: string;
  item_name: string;
  rate: number;
  charge_type: "per_dive" | "per_day";
  is_active: boolean;
};

export type Surcharges = {
  card: number;
  online: number;
};

export type ExchangeRate = {
  id: string;
  currency_code: string;
  rate_to_php: number;
  is_active: boolean;
};

export type GovtFee = {
  id: string;
  fee_name: string;
  amount: number;
  is_active: boolean;
};

export type PricingData = {
  pricingMode: PricingMode;
  hasOwnerPassword: boolean;
  courseRates: CourseRate[];
  packages: Package[];
  rateTiers: RateTier[];
  otherCharges: OtherCharge[];
  equipmentRentalRates: EquipmentRentalRate[];
  surcharges: Surcharges;
  exchangeRates: ExchangeRate[];
  govtFees: GovtFee[];
};

export async function loadPricingData(diveCenterId: string): Promise<PricingData> {
  const supabase = await createClient();

  const [
    { data: dc },
    { data: courseRates },
    { data: packages },
    { data: rateTiers },
    { data: otherCharges },
    { data: equipmentRentalRates },
    { data: surchargeRows },
    { data: exchangeRates },
    { data: govtFees },
  ] = await Promise.all([
    supabase
      .from("dive_centers")
      .select("pricing_mode, owner_unlock_hash")
      .eq("id", diveCenterId)
      .single(),
    supabase
      .from("course_rates")
      .select("id, course_name, rate, is_active")
      .eq("dive_center_id", diveCenterId)
      .order("course_name"),
    supabase
      .from("packages")
      .select("id, package_name, dive_site, price, equipment_included, is_active")
      .eq("dive_center_id", diveCenterId)
      .order("created_at"),
    supabase
      .from("rate_tiers")
      .select("id, rate_type, tier_from, tier_to, base_rate")
      .eq("dive_center_id", diveCenterId)
      .order("tier_from"),
    supabase
      .from("other_charges")
      .select("id, charge_name, amount, charge_type, sub_type, is_active")
      .eq("dive_center_id", diveCenterId)
      .order("charge_name"),
    supabase
      .from("equipment_rental_rates")
      .select("id, item_name, rate, charge_type, is_active")
      .eq("dive_center_id", diveCenterId)
      .order("item_name"),
    supabase
      .from("payment_surcharges")
      .select("surcharge_type, rate")
      .eq("dive_center_id", diveCenterId),
    supabase
      .from("exchange_rates")
      .select("id, currency_code, rate_to_php, is_active")
      .eq("dive_center_id", diveCenterId)
      .order("currency_code"),
    supabase
      .from("govt_fees")
      .select("id, fee_name, amount, is_active")
      .eq("dive_center_id", diveCenterId)
      .order("fee_name"),
  ]);

  const cardRow = (surchargeRows ?? []).find((r) => r.surcharge_type === "card");
  const onlineRow = (surchargeRows ?? []).find((r) => r.surcharge_type === "online");

  return {
    pricingMode: (dc?.pricing_mode as PricingMode) ?? null,
    hasOwnerPassword: !!dc?.owner_unlock_hash,
    courseRates: courseRates ?? [],
    packages: packages ?? [],
    rateTiers: rateTiers ?? [],
    otherCharges: otherCharges ?? [],
    equipmentRentalRates: equipmentRentalRates ?? [],
    // Stored as a fraction (0.035) in the rate column; sections convert to/from
    // a percentage for display.
    surcharges: {
      card: Math.round((cardRow?.rate ?? 0) * 100 * 10000) / 10000,
      online: Math.round((onlineRow?.rate ?? 0) * 100 * 10000) / 10000,
    },
    exchangeRates: exchangeRates ?? [],
    govtFees: govtFees ?? [],
  };
}

