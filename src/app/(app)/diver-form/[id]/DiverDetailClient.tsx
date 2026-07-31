"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfileHeader } from "./components/ProfileHeader";
import { FlagsBanner } from "./components/FlagsBanner";
import { EditProfileModal } from "./components/EditProfileModal";
import { CertCardModal } from "./components/CertCardModal";
import { EquipmentModal } from "./components/EquipmentModal";
import { NotesPanel } from "./components/NotesPanel";
import { VisitPanel } from "./components/VisitPanel";
import { BillSummary } from "./components/BillSummary";
import { DepositsPanel } from "./components/DepositsPanel";
import { InvoicePanel } from "./components/InvoicePanel";
import { BillUnlockModal } from "./components/BillUnlockModal";
import { DocumentsViewer } from "./components/DocumentsViewer";
import { getInvoiceForVisit } from "./actions";
import type {
  DiverDetail,
  DiverNote,
  EquipmentRentalItem,
  Visit,
  Activity,
  CourseRateOption,
  Deposit,
  ExistingPayment,
  PaymentConfig,
  VisitInvoice,
  RegistrationRecord,
  DiveSiteOption,
  PackageOption,
  RateSelection,
} from "./data";

export function DiverDetailClient({
  initialDiver,
  initialNotes,
  isOwner,
  rentalItems,
  initialVisit,
  initialActivities,
  courseRates,
  initialDeposits,
  existingPayment,
  paymentConfig,
  initialInvoice,
  diveCenterName,
  registrations,
  pricingMode,
  diveSites,
  packages,
  initialRateSelections,
}: {
  initialDiver: DiverDetail;
  initialNotes: DiverNote[];
  isOwner: boolean;
  rentalItems: EquipmentRentalItem[];
  initialVisit: Visit | null;
  initialActivities: Activity[];
  courseRates: CourseRateOption[];
  initialDeposits: Deposit[];
  existingPayment: ExistingPayment | null;
  paymentConfig: PaymentConfig;
  initialInvoice: VisitInvoice | null;
  diveCenterName: string;
  registrations: RegistrationRecord[];
  pricingMode: "tier" | "package";
  diveSites: DiveSiteOption[];
  packages: PackageOption[];
  initialRateSelections: RateSelection[];
}) {
  const [diver, setDiver] = useState(initialDiver);
  const [editOpen, setEditOpen] = useState(false);
  const [certCardOpen, setCertCardOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [visit, setVisit] = useState(initialVisit);
  const [activities, setActivities] = useState(initialActivities);
  const [deposits, setDeposits] = useState(initialDeposits);
  const [invoice, setInvoice] = useState(initialInvoice);
  const [unlockOpen, setUnlockOpen] = useState(false);
  // This page has two independent print-only sections (Invoice, Signed
  // Documents) that each render via a plain CSS `hidden print:block` —
  // with no coordination, a bare window.print() from either one's
  // button would print BOTH simultaneously, since both are print:block
  // at the same time. printTarget scopes which one is actually visible
  // during the print job that's currently in progress.
  const [printTarget, setPrintTarget] = useState<"invoice" | "documents" | null>(null);

  useEffect(() => {
    if (!printTarget) return;
    window.print();
  }, [printTarget]);

  useEffect(() => {
    function reset() {
      setPrintTarget(null);
    }
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  async function handleCheckedOut(invoiceId: string) {
    if (!visit) return;
    setVisit({ ...visit, isActive: false, visitStatus: "closed" });
    const fresh = await getInvoiceForVisit(invoiceId);
    if (fresh) setInvoice(fresh);
  }

  return (
    <div className="grid gap-5">
      <div className="print:hidden">
        <Link href="/diver-form" className="text-sm text-gray-500 hover:text-navy">
          ← Back to Divers
        </Link>
      </div>

      <FlagsBanner diver={diver} onUpdated={setDiver} />

      <ProfileHeader
        diver={diver}
        onEditClick={() => setEditOpen(true)}
        onCertCardClick={() => setCertCardOpen(true)}
        onEquipmentClick={() => setEquipmentOpen(true)}
      />

      <VisitPanel
        diverId={diver.id}
        visit={visit}
        setVisit={setVisit}
        activities={activities}
        setActivities={setActivities}
        courseRates={courseRates}
        pricingMode={pricingMode}
        diveSites={diveSites}
        packages={packages}
        rateSelections={initialRateSelections}
      />

      {visit && visit.isActive && visit.visitStatus === "open" && (
        <>
          <BillSummary
            diverId={diver.id}
            visit={visit}
            activities={activities}
            deposits={deposits}
            existingPayment={existingPayment}
            paymentConfig={paymentConfig}
            onCheckedOut={handleCheckedOut}
          />
          <DepositsPanel
            diverId={diver.id}
            visitId={visit.id}
            deposits={deposits}
            onAdded={(d) => setDeposits((prev) => [d, ...prev])}
          />
        </>
      )}

      {visit && visit.visitStatus === "closed" && invoice && (
        <InvoicePanel
          diverId={diver.id}
          diveCenterName={diveCenterName}
          invoice={invoice}
          onSent={() => setInvoice((prev) => (prev ? { ...prev, emailDeliveryStatus: "sent", emailSentAt: new Date().toISOString() } : prev))}
          onUnlockClick={() => setUnlockOpen(true)}
          isPrintTarget={printTarget === "invoice"}
          onPrintClick={() => setPrintTarget("invoice")}
        />
      )}

      {unlockOpen && visit && (
        <BillUnlockModal
          diverId={diver.id}
          visitId={visit.id}
          onClose={() => setUnlockOpen(false)}
          onUnlocked={() => window.location.reload()}
        />
      )}

      <DocumentsViewer
        registrations={registrations}
        diver={diver}
        isPrintTarget={printTarget === "documents"}
        onPrintClick={() => setPrintTarget("documents")}
      />

      <NotesPanel diverId={diver.id} initialNotes={initialNotes} isOwner={isOwner} />

      {editOpen && (
        <EditProfileModal
          diver={diver}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => setDiver(updated)}
        />
      )}
      {certCardOpen && diver.certCardUrl && (
        <CertCardModal certCardPath={diver.certCardUrl} onClose={() => setCertCardOpen(false)} />
      )}
      {equipmentOpen && (
        <EquipmentModal
          diver={diver}
          rentalItems={rentalItems}
          onClose={() => setEquipmentOpen(false)}
          onSaved={(updated) => setDiver(updated)}
        />
      )}
    </div>
  );
}
