import "server-only";
import { createClient } from "@/lib/supabase/server";

// ── Pricing engine ──────────────────────────────────────────────────────
//
// Reads the already-shipped Settings > Pricing & Rates / Courses / Dive
// Sites / Equipment Rental tables — no new config tables. TypeScript, not
// a Postgres function (see the plan's
// architectural note: the only existing server-side pricing logic in this
// codebase is compute_activity_total's trivial component sum and
// calculate_visit_total's trivial aggregate — neither does rate lookup, and
// every other money-sensitive feature already computes in TS).
//
// One deliberate deviation from the old app (diver-form.html), verified
// against this rebuild's real schema/Settings UI, not assumed: package-mode
// dive-rate resolution uses dive_sites.linked_package_id (a real, already-
// shipped Settings > Dive Sites field — a direct FK, set once
// per site) instead of the old app's fuzzy site-key text matching with a
// mid-flow "which package?" picker. The FK already resolves the ambiguity
// the old app needed a picker for, so no picker/visit_rate_selections use
// is needed for the common case. visit_rate_selections stays in the schema
// unused by this pass — a real UI for genuinely ambiguous multi-site rows
// (see below) is a reasonable follow-up, not built here.
//
// Scoped gap, documented rather than half-built: package-mode nitrox/15L
// add-on pricing has no equally clean dedicated mechanism (unlike tier mode,
// which has first-class rate_tiers rows for exactly this) and no default
// Settings item to match against — left as manual entry in package mode.

export type AutoPriceResult = {
  diveRate: number;
  fuelSurcharge: number;
  marineTax: number;
  sharkFee: number;
  nitroxFee: number;
  fifteenLFee: number;
  note: string | null;
};

const ZERO_RESULT: Omit<AutoPriceResult, "note"> = {
  diveRate: 0,
  fuelSurcharge: 0,
  marineTax: 0,
  sharkFee: 0,
  nitroxFee: 0,
  fifteenLFee: 0,
};

async function lookupOtherCharge(
  diveCenterId: string,
  chargeName: string,
  subType: string | null,
): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("other_charges")
    .select("amount")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true);
  query = subType ? query.eq("sub_type", subType) : query.eq("charge_name", chargeName).is("sub_type", null);
  const { data } = await query.maybeSingle();
  return Number(data?.amount) || 0;
}

type SiteMeta = { linkedPackageId: string | null; fuelEstimate: "Low" | "Medium" | "High"; sharkFee: boolean };

async function resolveSite(diveCenterId: string, diveSiteText: string): Promise<SiteMeta | null> {
  const firstSiteName = diveSiteText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (!firstSiteName) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("dive_sites")
    .select("linked_package_id, fuel_estimate, shark_fee")
    .eq("dive_center_id", diveCenterId)
    .ilike("site_name", firstSiteName)
    .maybeSingle();

  if (!data) return null;
  return {
    linkedPackageId: data.linked_package_id,
    fuelEstimate: data.fuel_estimate as "Low" | "Medium" | "High",
    sharkFee: !!data.shark_fee,
  };
}

async function otherChargesForSite(diveCenterId: string, site: SiteMeta | null): Promise<{ fuel: number; marine: number; shark: number }> {
  const marine = await lookupOtherCharge(diveCenterId, "Marine Tax", null);
  if (!site) return { fuel: 0, marine, shark: 0 };

  const fuel =
    site.fuelEstimate === "Medium"
      ? await lookupOtherCharge(diveCenterId, "", "medium")
      : site.fuelEstimate === "High"
        ? await lookupOtherCharge(diveCenterId, "", "high")
        : 0;
  const shark = site.sharkFee ? await lookupOtherCharge(diveCenterId, "Shark Fee", null) : 0;

  return { fuel, marine, shark };
}

export async function autoPriceCourseMode(diveCenterId: string, courseRateId: string | null): Promise<AutoPriceResult> {
  if (!courseRateId) {
    return { ...ZERO_RESULT, note: "This visit has no course selected yet." };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_rates")
    .select("rate")
    .eq("id", courseRateId)
    .eq("dive_center_id", diveCenterId)
    .maybeSingle();

  return { ...ZERO_RESULT, diveRate: Number(data?.rate) || 0, note: null };
}

export async function autoPricePackageMode(diveCenterId: string, diveSiteText: string): Promise<AutoPriceResult> {
  const site = await resolveSite(diveCenterId, diveSiteText);
  const { fuel, marine, shark } = await otherChargesForSite(diveCenterId, site);

  if (!site) {
    return { ...ZERO_RESULT, fuelSurcharge: fuel, marineTax: marine, sharkFee: shark, note: "No matching dive site configured — enter the dive rate manually." };
  }
  if (!site.linkedPackageId) {
    return { ...ZERO_RESULT, fuelSurcharge: fuel, marineTax: marine, sharkFee: shark, note: "This dive site has no linked package (set one in Settings > Dive Sites) — enter the dive rate manually." };
  }

  const supabase = await createClient();
  const { data: pkg } = await supabase
    .from("packages")
    .select("price")
    .eq("id", site.linkedPackageId)
    .eq("dive_center_id", diveCenterId)
    .maybeSingle();

  return {
    diveRate: Number(pkg?.price) || 0,
    fuelSurcharge: fuel,
    marineTax: marine,
    sharkFee: shark,
    nitroxFee: 0,
    fifteenLFee: 0,
    note: null,
  };
}

export async function autoPriceTierMode(
  diveCenterId: string,
  diveSiteText: string,
  cumulativeDiveCount: number,
  wantsNitrox: boolean,
  wants15L: boolean,
): Promise<AutoPriceResult> {
  const supabase = await createClient();

  async function tierRate(rateType: "base_dive" | "nitrox" | "tank_15l"): Promise<number> {
    const { data } = await supabase
      .from("rate_tiers")
      .select("base_rate, tier_from")
      .eq("dive_center_id", diveCenterId)
      .eq("rate_type", rateType)
      .lte("tier_from", cumulativeDiveCount)
      .or(`tier_to.is.null,tier_to.gte.${cumulativeDiveCount}`)
      .order("tier_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    return Number(data?.base_rate) || 0;
  }

  const [diveRate, nitroxFee, fifteenLFee] = await Promise.all([
    tierRate("base_dive"),
    wantsNitrox ? tierRate("nitrox") : Promise.resolve(0),
    wants15L ? tierRate("tank_15l") : Promise.resolve(0),
  ]);

  const site = await resolveSite(diveCenterId, diveSiteText);
  const { fuel, marine, shark } = await otherChargesForSite(diveCenterId, site);

  return {
    diveRate,
    fuelSurcharge: fuel,
    marineTax: marine,
    sharkFee: shark,
    nitroxFee,
    fifteenLFee,
    note: diveRate === 0 ? "No tier rate configured for this dive count — enter the dive rate manually." : null,
  };
}

// Which of the three per-dive-site charges apply as 'per_day' (charged once
// per calendar date across the visit) vs 'per_dive' (every row) — used by
// the Server Action to zero out a charge on a row if an earlier row already
// carries it for the same date under a per_day cadence.
export async function getChargeCadence(
  diveCenterId: string,
): Promise<{ marineTax: "per_dive" | "per_day"; sharkFee: "per_dive" | "per_day"; fuelMedium: "per_dive" | "per_day"; fuelHigh: "per_dive" | "per_day" }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("other_charges")
    .select("charge_name, sub_type, charge_type")
    .eq("dive_center_id", diveCenterId);

  const rows = data ?? [];
  const find = (name: string, subType: string | null) =>
    (subType
      ? rows.find((r) => r.sub_type === subType)
      : rows.find((r) => r.charge_name === name && !r.sub_type)
    )?.charge_type ?? "per_dive";

  return {
    marineTax: find("Marine Tax", null),
    sharkFee: find("Shark Fee", null),
    fuelMedium: find("", "medium"),
    fuelHigh: find("", "high"),
  };
}
