"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CURRENCIES } from "./constants";

function ok() {
  revalidatePath("/settings/exchange-rates");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
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

// Settings > Exchange Rates always *displays* DEFAULT_CURRENCIES as if
// already active (ExchangeRatesSection.tsx's buildRows falls back to
// each default's own suggested rate/active state) even when nothing's
// actually been saved yet — a real dive center that's never opened this
// tab has zero real rows, so any other page reading exchange_rates
// directly (Diver Form's currency dropdown) sees nothing. Seeded once,
// for real, the first time this page loads with zero rows — same shape
// as this codebase's existing DEFAULT_COURSES auto-seed-on-first-use
// precedent (courses/constants.ts, seeded via confirmPricingMode).
export async function seedDefaultCurrencies() {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("exchange_rates").insert(
    DEFAULT_CURRENCIES.map((c) => ({
      dive_center_id: user.diveCenterId,
      currency_code: c.code,
      rate_to_php: c.rate,
      is_active: true,
    })),
  );
  if (error) console.error("Could not seed default currencies:", error.message);
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
