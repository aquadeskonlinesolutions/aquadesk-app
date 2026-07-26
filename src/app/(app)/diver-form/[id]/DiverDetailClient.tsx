"use client";

import { useState } from "react";
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

      <DocumentsViewer registrations={registrations} />

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
