import { requireOwner } from "@/lib/dal";
import { loadPricingData } from "./data";
import { PricingModeSection } from "./PricingModeSection";
import { PackagesSection } from "./PackagesSection";
import { TieredRatesSection } from "./TieredRatesSection";
import { OtherChargesSection } from "./OtherChargesSection";
import { CommissionRatesSection } from "./CommissionRatesSection";

export default async function SettingsPricingPage() {
  const user = await requireOwner();
  const data = await loadPricingData(user.diveCenterId);

  return (
    <div>
      <PricingModeSection
        pricingMode={data.pricingMode}
        hasOwnerPassword={data.hasOwnerPassword}
      />

      {data.pricingMode === "package" && <PackagesSection packages={data.packages} />}
      {data.pricingMode === "tier" && <TieredRatesSection tiers={data.rateTiers} />}

      <OtherChargesSection charges={data.otherCharges} />
      <CommissionRatesSection rates={data.commissionRates} />
    </div>
  );
}
