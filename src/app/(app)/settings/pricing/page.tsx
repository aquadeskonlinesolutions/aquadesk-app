import { requireOwner } from "@/lib/dal";
import { loadPricingData } from "./data";
import { PricingModeSection } from "./PricingModeSection";
import { PackagesSection } from "./PackagesSection";
import { TieredRatesSection } from "./TieredRatesSection";
import { CourseRatesSection } from "./CourseRatesSection";
import { EquipmentRentalSection } from "./EquipmentRentalSection";
import { OtherChargesSection } from "./OtherChargesSection";
import { SurchargesSection } from "./SurchargesSection";
import { ExchangeRatesSection } from "./ExchangeRatesSection";

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

      <CourseRatesSection courses={data.courseRates} />
      <EquipmentRentalSection rates={data.equipmentRentalRates} />
      <OtherChargesSection charges={data.otherCharges} />
      <SurchargesSection surcharges={data.surcharges} />
      <ExchangeRatesSection rates={data.exchangeRates} />
    </div>
  );
}
