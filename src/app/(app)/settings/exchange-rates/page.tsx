import { requireOwner } from "@/lib/dal";
import { loadExchangeRatesData } from "./data";
import { seedDefaultCurrencies } from "./actions";
import { SurchargesSection } from "./SurchargesSection";
import { ExchangeRatesSection } from "./ExchangeRatesSection";

export default async function SettingsExchangeRatesPage() {
  const user = await requireOwner();
  let data = await loadExchangeRatesData(user.diveCenterId);

  // A dive center that's never opened this tab has zero real exchange_rates
  // rows, even though the section below always shows suggested defaults as
  // if active — seed them for real once, the first time this loads empty.
  if (data.exchangeRates.length === 0) {
    await seedDefaultCurrencies();
    data = await loadExchangeRatesData(user.diveCenterId);
  }

  return (
    <div>
      <SurchargesSection surcharges={data.surcharges} />
      <ExchangeRatesSection rates={data.exchangeRates} />
    </div>
  );
}
