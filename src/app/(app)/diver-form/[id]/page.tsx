import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import {
  loadDiverDetail,
  loadDiverNotes,
  loadEquipmentRentalRates,
  loadLatestVisit,
  loadActivities,
  loadCourseRates,
  loadDeposits,
  loadExistingPayment,
  loadPaymentConfig,
  loadInvoiceForVisit,
  loadDiverRegistrations,
  loadDiveSites,
  loadActivePackages,
  loadRateSelections,
} from "./data";
import { createClient } from "@/lib/supabase/server";
import { DiverDetailClient } from "./DiverDetailClient";

export default async function DiverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const diver = await loadDiverDetail(id, user.diveCenterId);

  if (!diver) notFound();

  const supabase = await createClient();
  const [notes, rentalItems, visit, courseRates, paymentConfig, dc, registrations, diveSites, packages] =
    await Promise.all([
      loadDiverNotes(id),
      loadEquipmentRentalRates(user.diveCenterId),
      loadLatestVisit(id, user.diveCenterId),
      loadCourseRates(user.diveCenterId),
      loadPaymentConfig(user.diveCenterId),
      supabase.from("dive_centers").select("name, pricing_mode").eq("id", user.diveCenterId).single(),
      loadDiverRegistrations(id),
      loadDiveSites(user.diveCenterId),
      loadActivePackages(user.diveCenterId),
    ]);
  const [activities, deposits, existingPayment, rateSelections] = visit
    ? await Promise.all([
        loadActivities(visit.id),
        loadDeposits(visit.id),
        loadExistingPayment(visit.id),
        loadRateSelections(visit.id),
      ])
    : [[], [], null, []];
  const invoice = visit && visit.visitStatus === "closed" ? await loadInvoiceForVisit(visit.id) : null;

  return (
    <DiverDetailClient
      initialDiver={diver}
      initialNotes={notes}
      isOwner={user.role === "owner"}
      rentalItems={rentalItems}
      initialVisit={visit}
      initialActivities={activities}
      courseRates={courseRates}
      initialDeposits={deposits}
      existingPayment={existingPayment}
      paymentConfig={paymentConfig}
      initialInvoice={invoice}
      diveCenterName={dc.data?.name ?? "Dive Center"}
      registrations={registrations}
      pricingMode={dc.data?.pricing_mode === "package" ? "package" : "tier"}
      diveSites={diveSites}
      packages={packages}
      initialRateSelections={rateSelections}
    />
  );
}
