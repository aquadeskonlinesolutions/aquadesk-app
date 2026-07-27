import "server-only";
import { createClient } from "@/lib/supabase/server";

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

export type ExchangeRatesData = {
  surcharges: Surcharges;
  exchangeRates: ExchangeRate[];
};

export async function loadExchangeRatesData(diveCenterId: string): Promise<ExchangeRatesData> {
  const supabase = await createClient();

  const [{ data: surchargeRows }, { data: exchangeRates }] = await Promise.all([
    supabase
      .from("payment_surcharges")
      .select("surcharge_type, rate")
      .eq("dive_center_id", diveCenterId),
    supabase
      .from("exchange_rates")
      .select("id, currency_code, rate_to_php, is_active")
      .eq("dive_center_id", diveCenterId)
      .order("currency_code"),
  ]);

  const cardRow = (surchargeRows ?? []).find((r) => r.surcharge_type === "card");
  const onlineRow = (surchargeRows ?? []).find((r) => r.surcharge_type === "online");

  return {
    // Stored as a fraction (0.035) in the rate column; the section converts
    // to/from a percentage for display.
    surcharges: {
      card: Math.round((cardRow?.rate ?? 0) * 100 * 10000) / 10000,
      online: Math.round((onlineRow?.rate ?? 0) * 100 * 10000) / 10000,
    },
    exchangeRates: exchangeRates ?? [],
  };
}
