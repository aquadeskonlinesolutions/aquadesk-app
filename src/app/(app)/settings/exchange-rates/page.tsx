import { requireOwner } from "@/lib/dal";
import { loadExchangeRatesData } from "./data";
import { SurchargesSection } from "./SurchargesSection";
import { ExchangeRatesSection } from "./ExchangeRatesSection";

export default async function SettingsExchangeRatesPage() {
  const user = await requireOwner();
  const data = await loadExchangeRatesData(user.diveCenterId);

  return (
    <div>
      <SurchargesSection surcharges={data.surcharges} />
      <ExchangeRatesSection rates={data.exchangeRates} />
    </div>
  );
}
