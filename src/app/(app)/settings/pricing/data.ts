import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PricingMode = "package" | "tier" | null;

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

export type CommissionRates = {
  divemasterRatePerDive: number;
  ratioBonusEnabled: boolean;
  ratioBonusExtraRate: number;
  joinRideRatePerDiverPerDive: number;
};

export type PricingData = {
  pricingMode: PricingMode;
  hasOwnerPassword: boolean;
  packages: Package[];
  rateTiers: RateTier[];
  otherCharges: OtherCharge[];
  commissionRates: CommissionRates;
};

export async function loadPricingData(diveCenterId: string): Promise<PricingData> {
  const supabase = await createClient();

  const [{ data: dc }, { data: packages }, { data: rateTiers }, { data: otherCharges }] =
    await Promise.all([
      supabase
        .from("dive_centers")
        .select(
          "pricing_mode, owner_unlock_hash, divemaster_rate_per_dive, ratio_bonus_enabled, ratio_bonus_extra_rate, join_ride_rate_per_diver_per_dive",
        )
        .eq("id", diveCenterId)
        .single(),
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
    ]);

  return {
    pricingMode: (dc?.pricing_mode as PricingMode) ?? null,
    hasOwnerPassword: !!dc?.owner_unlock_hash,
    packages: packages ?? [],
    rateTiers: rateTiers ?? [],
    otherCharges: otherCharges ?? [],
    commissionRates: {
      divemasterRatePerDive: Number(dc?.divemaster_rate_per_dive ?? 0),
      ratioBonusEnabled: !!dc?.ratio_bonus_enabled,
      ratioBonusExtraRate: Number(dc?.ratio_bonus_extra_rate ?? 0),
      joinRideRatePerDiverPerDive: Number(dc?.join_ride_rate_per_diver_per_dive ?? 0),
    },
  };
}
