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
// Package-mode dive-rate resolution matches the live app's real
// diver-form.html/scheduling.html mechanism exactly (corrected in a later
// session — an earlier version of this file used dive_sites.
// linked_package_id, a 1-site-to-1-package FK, which can't represent a
// real multi-site package like "Shark Diving" = "Kimud, Kimud, Monad").
// A package's dive_site column (already real,
// settings/pricing/PackagesSection.tsx's "Dive Site Combination" field)
// is a free-text, ordered, repeatable list of every real site visit the
// package covers. Matching normalizes both sides the same way the live
// app's normalizePackageSites()/findPackageBySiteKey() do — split, trim,
// lowercase, sort, join — and compares the *whole trip's* site
// combination (Scheduling's markBoatReturned now writes exactly this
// combined string for package-mode trips) against every package's own
// normalized dive_site. linked_package_id stays untouched and unread by
// pricing — confirmed the live app also keeps its site->package FK as a
// pure Settings-UI cross-reference label, never used for pricing.
//
// Scoped gap, documented rather than half-built: 0-or-2+ package matches
// just fall back to "enter manually" (same as no match) — the live app's
// ambiguous-match picker (visit_rate_selections.site_key) is a real
// schema-already-exists follow-up, not built here.
//
// Separate scoped gap, unrelated to the above: package-mode nitrox/15L
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

export type SiteMeta = { fuelEstimate: "Low" | "Medium" | "High"; sharkFee: boolean };

export async function resolveSite(diveCenterId: string, diveSiteText: string): Promise<SiteMeta | null> {
  const firstSiteName = diveSiteText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (!firstSiteName) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("dive_sites")
    .select("fuel_estimate, shark_fee")
    .eq("dive_center_id", diveCenterId)
    .ilike("site_name", firstSiteName)
    .maybeSingle();

  if (!data) return null;
  return {
    fuelEstimate: data.fuel_estimate as "Low" | "Medium" | "High",
    sharkFee: !!data.shark_fee,
  };
}

// Matches diver-form.html's normalizePackageSites(): split on common
// separators, trim, lowercase, sort, join — order-independent so
// "Kimud, Monad, Kimud" and "Kimud, Kimud, Monad" match the same package.
export function normalizeSiteKey(text: string): string {
  return text
    .split(/[,|+•;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

async function resolvePackageBySiteCombo(
  diveCenterId: string,
  diveSiteText: string,
): Promise<{ price: number } | null> {
  const key = normalizeSiteKey(diveSiteText);
  if (!key) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("packages")
    .select("dive_site, price")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true);

  const match = (data ?? []).find((p) => normalizeSiteKey(p.dive_site ?? "") === key);
  return match ? { price: Number(match.price) || 0 } : null;
}

// Every active package whose own site-combination normalizes to the same
// key — used by Apply Charges' ambiguity check (0 or 2+ matches need a
// human pick, exactly 1 resolves silently, same as resolvePackageBySiteCombo
// above but returning every candidate instead of the first).
export async function findPackagesBySiteKey(
  diveCenterId: string,
  siteKey: string,
): Promise<{ id: string; packageName: string; price: number }[]> {
  if (!siteKey) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("packages")
    .select("id, package_name, dive_site, price")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true);

  return (data ?? [])
    .filter((p) => normalizeSiteKey(p.dive_site ?? "") === siteKey)
    .map((p) => ({ id: p.id, packageName: p.package_name, price: Number(p.price) || 0 }));
}

export async function otherChargesForSite(diveCenterId: string, site: SiteMeta | null): Promise<{ fuel: number; marine: number; shark: number }> {
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
  // Fuel/marine/shark stay resolved from the row's first real site name —
  // unrelated to which package matched, unchanged from before.
  const site = await resolveSite(diveCenterId, diveSiteText);
  const { fuel, marine, shark } = await otherChargesForSite(diveCenterId, site);

  const pkg = await resolvePackageBySiteCombo(diveCenterId, diveSiteText);
  if (!pkg) {
    return {
      ...ZERO_RESULT,
      fuelSurcharge: fuel,
      marineTax: marine,
      sharkFee: shark,
      note: "No matching package configured for this dive-site combination (set one in Settings > Pricing & Rates > Packages) — enter the dive rate manually.",
    };
  }

  return {
    diveRate: pkg.price,
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
