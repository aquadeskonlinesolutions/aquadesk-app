"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignaturePad } from "@/components/SignaturePad";
import {
  RegistrationConfig,
  CERTIFICATION_LEVELS,
  TRAINING_AGENCIES,
  RELATIONSHIPS,
  CERT_LEVEL_TO_DB,
  AGENCY_TO_DB,
} from "./types";

const inputClass =
  "w-full rounded-card border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal";
const labelClass = "block text-sm font-medium text-navy mb-1.5";
const requiredMark = <span className="text-red ml-0.5">*</span>;

type FormState = {
  firstName: string;
  lastName: string;
  birthday: string;
  nationality: string;
  arrivalDate: string;
  departureDate: string;
  accommodation: string;
  email: string;
  phone: string;
  whatsapp: string;
  ecName: string;
  ecPhone: string;
  ecWhatsapp: string;
  ecEmail: string;
  ecRelationship: string;
  certLevel: string;
  agency: string;
  loggedDives: string;
  lastDiveDate: string;
  nitroxCertified: boolean;
  foodAllergies: string;
  hasDiveInsurance: boolean | null;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  wantsInsuranceReferral: boolean | null;
  needsEquipment: boolean | null;
  equipmentSelections: Record<string, boolean>;
  wantsComputer: boolean;
  medicalAnswers: Record<string, boolean>;
  privacyAgreed: boolean;
  waiverAgreed: boolean;
  signatureDataUrl: string | null;
};

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  birthday: "",
  nationality: "",
  arrivalDate: "",
  departureDate: "",
  accommodation: "",
  email: "",
  phone: "",
  whatsapp: "",
  ecName: "",
  ecPhone: "",
  ecWhatsapp: "",
  ecEmail: "",
  ecRelationship: "",
  certLevel: "",
  agency: "",
  loggedDives: "",
  lastDiveDate: "",
  nitroxCertified: false,
  foodAllergies: "",
  hasDiveInsurance: null,
  insuranceProvider: "",
  insurancePolicyNumber: "",
  wantsInsuranceReferral: null,
  needsEquipment: null,
  equipmentSelections: {},
  wantsComputer: false,
  medicalAnswers: {},
  privacyAgreed: false,
  waiverAgreed: false,
  signatureDataUrl: null,
};

const STEP_LABELS = [
  "Welcome",
  "Data Privacy Consent",
  "Personal Information",
  "Contact Information",
  "Emergency Contact",
  "Diver Details",
  "Equipment",
  "Health Declaration",
  "Waiver & Signature",
];

function calcAge(birthday: string): number | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

export function RegistrationWizard({
  diveCenterId,
  groupId,
}: {
  diveCenterId: string;
  groupId: string | null;
}) {
  const supabase = createClient();
  const [config, setConfig] = useState<RegistrationConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    firstName: string;
    arrivalDate: string;
    departureDate: string;
    isMinor: boolean;
  } | null>(null);

  // Returning-diver flow
  const [foundDiver, setFoundDiver] = useState<{
    id: string;
    first_name: string;
    last_name: string;
  } | null>(null);
  const [isReturningDiver, setIsReturningDiver] = useState(false);
  const [existingDiverId, setExistingDiverId] = useState<string | null>(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);
  const [returningNotice, setReturningNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_registration_config", {
        p_dive_center_id: diveCenterId,
        p_group_id: groupId,
      });
      if (cancelled) return;
      if (error) {
        setLoadError("Could not load this registration form. Please try again.");
        return;
      }
      const cfg = data as RegistrationConfig;
      if (cfg?.error) {
        setLoadError(cfg.error);
        return;
      }
      setConfig(cfg);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diveCenterId, groupId]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Nested-map updates must go through the functional setState form too —
  // two of these firing in the same React batch (e.g. answering two medical
  // questions in quick succession) would otherwise both read the same stale
  // `form.medicalAnswers` snapshot and the second click's answer would
  // silently overwrite-and-lose the first.
  function setMedicalAnswer(questionId: string, value: boolean) {
    setForm((f) => ({ ...f, medicalAnswers: { ...f.medicalAnswers, [questionId]: value } }));
  }

  function setEquipmentSelection(key: string, checked: boolean) {
    setForm((f) => ({
      ...f,
      equipmentSelections: { ...f.equipmentSelections, [key]: checked },
    }));
  }

  const age = calcAge(form.birthday);
  const isMinor = age !== null && age < 18;

  async function checkReturningDiver() {
    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const { data } = await supabase.rpc("check_returning_diver", {
      p_dive_center_id: diveCenterId,
      p_email: email,
    });
    const match = data?.[0] ?? null;
    setFoundDiver(match);
    if (!match) {
      setIsReturningDiver(false);
      setExistingDiverId(null);
      setIsDuplicateEmail(false);
      setReturningNotice(null);
    }
  }

  async function confirmReturningDiver() {
    if (!foundDiver) return;
    setIsReturningDiver(true);
    setExistingDiverId(foundDiver.id);
    setIsDuplicateEmail(false);

    const { data } = await supabase.rpc("get_diver_prefill", {
      p_diver_id: foundDiver.id,
      p_dive_center_id: diveCenterId,
    });
    const prefill = data?.[0];
    if (prefill) {
      setForm((f) => ({
        ...f,
        firstName: prefill.first_name ?? f.firstName,
        lastName: prefill.last_name ?? f.lastName,
        nationality: prefill.nationality ?? f.nationality,
        birthday: prefill.birthday ?? f.birthday,
        phone: prefill.phone ?? f.phone,
        whatsapp: prefill.whatsapp ?? f.whatsapp,
      }));
    }
    setReturningNotice(
      `Welcome back${prefill?.first_name ? ", " + prefill.first_name : ""}! We've filled in your saved details.`,
    );
    setFoundDiver(null);
  }

  function denyReturningDiver() {
    setIsReturningDiver(false);
    setExistingDiverId(null);
    setIsDuplicateEmail(true);
    setFoundDiver(null);
  }

  function allMedicalAnswered(): boolean {
    const questions = config?.medical_questions ?? [];
    if (questions.length === 0) return true;
    return questions.every((q) => form.medicalAnswers[q.id] !== undefined);
  }

  function anyMedicalYes(): boolean {
    const questions = config?.medical_questions ?? [];
    return questions.some((q) => form.medicalAnswers[q.id] === true);
  }

  function getStepErrors(n: number): string[] {
    const e: string[] = [];
    if (n === 1) {
      if (!form.privacyAgreed) e.push("Please consent to data privacy collection to continue.");
    }
    if (n === 2) {
      if (!form.firstName.trim()) e.push("First name is required.");
      if (!form.lastName.trim()) e.push("Last name is required.");
      if (!form.birthday) e.push("Birthday is required.");
      if (!form.nationality.trim()) e.push("Nationality is required.");
      if (!form.arrivalDate) e.push("Arrival date is required.");
      if (!form.departureDate) e.push("Departure date is required.");
      if (form.arrivalDate && form.departureDate && form.departureDate < form.arrivalDate) {
        e.push("Departure date must be on or after your arrival date.");
      }
      if (!form.accommodation.trim()) e.push("Accommodation is required.");
    }
    if (n === 3) {
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        e.push("A valid email address is required.");
      }
      if (!form.whatsapp.trim()) e.push("A WhatsApp number is required.");
    }
    if (n === 4) {
      if (!form.ecName.trim()) e.push("Emergency contact name is required.");
      if (!form.ecPhone.trim()) e.push("Emergency contact phone is required.");
      if (!form.ecWhatsapp.trim()) e.push("Emergency contact WhatsApp is required.");
      if (!form.ecRelationship) e.push("Emergency contact relationship is required.");
    }
    if (n === 5) {
      if (!form.certLevel) e.push("Certification level is required.");
      if (!form.loggedDives.trim()) e.push("Logged dives is required (enter 0 if none).");
      if (form.certLevel && form.certLevel !== "None" && !form.lastDiveDate) {
        e.push("Last dive date is required for certified divers.");
      }
    }
    if (n === 7) {
      if (!allMedicalAnswered()) e.push("Please answer every health question.");
    }
    if (n === 8) {
      if (!form.waiverAgreed) e.push("Please agree to the waiver.");
      if (!form.signatureDataUrl) e.push("Please provide your signature.");
    }
    return e;
  }

  function goToStep(n: number) {
    const stepErrors = getStepErrors(step);
    if (n > step && stepErrors.length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors([]);
    setStep(n);
  }

  async function handleSubmit() {
    const stepErrors = getStepErrors(8);
    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    const dcName = config?.dive_center?.name ?? "the dive center";
    const resolvedPrivacyNotice = (config?.privacy_notice ?? "").split("[Dive Center Name]").join(dcName);

    const selectedItems = Object.entries(form.equipmentSelections)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const medicalSnapshot = (config?.medical_questions ?? []).map((q) => ({
      question_text: q.question_text,
      answer: form.medicalAnswers[q.id] ?? null,
    }));

    const payload = {
      dive_center_id: diveCenterId,
      existing_diver_id: isReturningDiver ? existingDiverId : null,
      group_id: config?.group?.id ?? groupId ?? null,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      birthday: form.birthday,
      age,
      nationality: form.nationality.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim(),
      certification_level: CERT_LEVEL_TO_DB[form.certLevel] ?? "none",
      training_agency: form.agency ? AGENCY_TO_DB[form.agency] : null,
      logged_dives: parseInt(form.loggedDives, 10) || 0,
      nitrox_certified: form.nitroxCertified,
      needs_equipment: form.needsEquipment === true,
      equipment_preference: form.needsEquipment ? "partial" : "none",
      equipment_requested: JSON.stringify({ items: selectedItems, computer: form.wantsComputer }),
      arrival_date: form.arrivalDate,
      departure_date: form.departureDate,
      accommodation: form.accommodation.trim(),
      emergency_contact_name: form.ecName.trim(),
      emergency_contact_phone: form.ecPhone.trim(),
      emergency_contact_whatsapp: form.ecWhatsapp.trim(),
      emergency_contact_email: form.ecEmail.trim() || null,
      emergency_contact_relationship: form.ecRelationship,
      last_dive_date: form.certLevel !== "None" ? form.lastDiveDate || null : null,
      food_allergies: form.foodAllergies.trim() || null,
      has_dive_insurance: form.hasDiveInsurance,
      insurance_provider:
        form.hasDiveInsurance === true ? form.insuranceProvider.trim() || null : null,
      insurance_policy_number:
        form.hasDiveInsurance === true ? form.insurancePolicyNumber.trim() || null : null,
      wants_insurance_referral:
        form.hasDiveInsurance === false ? form.wantsInsuranceReferral : null,
      medical_answers: form.medicalAnswers,
      medical_answers_snapshot: medicalSnapshot,
      medical_flag: anyMedicalYes(),
      privacy_consent_at: new Date().toISOString(),
      privacy_notice_snapshot: resolvedPrivacyNotice,
      waiver_content_snapshot: config?.dive_center?.waiver_content ?? null,
      waiver_date: new Date().toISOString(),
      waiver_signed: true,
      waiver_opened: true,
      waiver_signature_url: form.signatureDataUrl,
      duplicate_email_flag: isDuplicateEmail,
    };

    const { error } = await supabase.rpc("submit_diver_registration", {
      p_payload: payload,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError("Something went wrong. Please check your details and try again.");
      return;
    }

    setConfirmation({
      firstName: form.firstName,
      arrivalDate: form.arrivalDate,
      departureDate: form.departureDate,
      isMinor,
    });
    setStep(9);
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-off-white px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl text-navy mb-2">Not available</h1>
          <p className="text-gray-600 text-sm">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-off-white">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  const dc = config.dive_center!;

  return (
    <div className="min-h-screen bg-off-white py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          {dc.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dc.logo_url} alt="" className="w-10 h-10 rounded object-contain" />
          )}
          <div>
            <div className="font-display text-xl text-navy">{dc.name}</div>
            <div className="text-xs text-gray-500">Diver Registration</div>
          </div>
        </div>

        {config.group && (
          <div className="bg-teal-light text-teal-mid rounded-card px-4 py-3 mb-4 text-sm">
            <div className="font-medium">{config.group.group_name}</div>
            <div className="text-xs">
              {config.group.arrival_date ? `Arrival: ${config.group.arrival_date} · ` : ""}
              {config.group.expected_count != null
                ? `${config.group.registered_count}/${config.group.expected_count} registered`
                : ""}
            </div>
          </div>
        )}

        {step >= 1 && step <= 8 && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{STEP_LABELS[step]}</span>
              <span>Step {step} of 8</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal transition-all"
                style={{ width: `${(step / 8) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="bg-white rounded-card-lg shadow-card border border-gray-200 p-6">
          {errors.length > 0 && (
            <div className="mb-4 bg-red-light border border-red/30 rounded-card p-3">
              <ul className="text-sm text-red list-disc pl-4">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ---- STEP 0: WELCOME ---- */}
          {step === 0 && (
            <div>
              <h1 className="font-display text-2xl text-navy mb-3">Welcome</h1>
              <p className="text-gray-600 text-sm mb-6">
                Please complete this registration before your dive with{" "}
                {dc.name}. It takes about 5 minutes and covers your personal
                details, health questions, and liability waiver.
              </p>
              <button
                onClick={() => goToStep(1)}
                className="w-full rounded-card bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-dark transition-colors"
              >
                Get started →
              </button>
            </div>
          )}

          {/* ---- STEP 1: PRIVACY CONSENT ---- */}
          {step === 1 && (
            <div>
              <h2 className="font-display text-xl text-navy mb-3">
                Data Privacy Consent
              </h2>
              <div
                className="text-sm text-gray-700 max-h-64 overflow-y-auto border border-gray-200 rounded-card p-3 mb-4"
                dangerouslySetInnerHTML={{
                  __html: (config.privacy_notice ?? "").split("[Dive Center Name]").join(dc.name),
                }}
              />
              <label className="flex items-start gap-2 text-sm mb-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.privacyAgreed}
                  onChange={(e) => setField("privacyAgreed", e.target.checked)}
                  className="mt-0.5"
                />
                I consent to the collection and use of my information as
                described above.
              </label>
              <div className="flex gap-3">
                <button onClick={() => goToStep(0)} className="text-sm text-gray-600">
                  ← Back
                </button>
                <button
                  onClick={() => goToStep(2)}
                  className="flex-1 rounded-card bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-dark transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ---- STEP 2: PERSONAL INFORMATION ---- */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-navy mb-1">
                Personal Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>First Name{requiredMark}</label>
                  <input
                    className={inputClass}
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className={labelClass}>Last Name{requiredMark}</label>
                  <input
                    className={inputClass}
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                    placeholder="Santos"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Birthday{requiredMark}</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.birthday}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setField("birthday", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Age</label>
                  <input
                    className={`${inputClass} bg-gray-100 text-gray-600`}
                    value={age ?? ""}
                    readOnly
                    placeholder="Auto"
                  />
                </div>
              </div>
              {isMinor && (
                <div className="bg-orange-light border border-orange/30 text-orange text-xs rounded-card px-3 py-2">
                  Thanks for letting us know. Since the diver is under 18,
                  additional documents may be needed on arrival — the dive
                  center team will guide you.
                </div>
              )}
              <div>
                <label className={labelClass}>Nationality{requiredMark}</label>
                <input
                  className={inputClass}
                  value={form.nationality}
                  onChange={(e) => setField("nationality", e.target.value)}
                  placeholder="Filipino"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Arrival to Island{requiredMark}</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.arrivalDate}
                    onChange={(e) => setField("arrivalDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Departure from Island{requiredMark}</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.departureDate}
                    min={form.arrivalDate || undefined}
                    onChange={(e) => setField("departureDate", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Hotel / Accommodation{requiredMark}</label>
                <input
                  className={inputClass}
                  value={form.accommodation}
                  onChange={(e) => setField("accommodation", e.target.value)}
                  placeholder="e.g. Tepanee Beach Resort"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => goToStep(1)} className="text-sm text-gray-600">
                  ← Back
                </button>
                <button
                  onClick={() => goToStep(3)}
                  className="flex-1 rounded-card bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-dark transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ---- STEP 3: CONTACT INFORMATION ---- */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-navy mb-1">
                Contact Information
              </h2>
              <div>
                <label className={labelClass}>Email Address{requiredMark}</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  onBlur={checkReturningDiver}
                  placeholder="juan@email.com"
                />
              </div>

              {foundDiver && (
                <div className="bg-teal-light rounded-card p-3 text-sm">
                  <p className="mb-2">
                    Is this you? — {foundDiver.first_name} {foundDiver.last_name}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmReturningDiver}
                      className="rounded-card bg-navy text-white px-3 py-1.5 text-xs font-medium"
                    >
                      Yes, that&apos;s me
                    </button>
                    <button
                      onClick={denyReturningDiver}
                      className="rounded-card border border-gray-300 px-3 py-1.5 text-xs font-medium"
                    >
                      No, different person
                    </button>
                  </div>
                </div>
              )}
              {returningNotice && (
                <div className="bg-green-light text-green rounded-card px-3 py-2 text-xs">
                  {returningNotice}
                </div>
              )}
              {isDuplicateEmail && (
                <div className="bg-orange-light text-orange rounded-card px-3 py-2 text-xs">
                  We&apos;ll register you as a new diver. The dive center may
                  follow up since this email is already on file for someone
                  else.
                </div>
              )}

              <div>
                <label className={labelClass}>
                  Phone Number <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="+63 917 123 4567"
                />
              </div>
              <div>
                <label className={labelClass}>WhatsApp Number{requiredMark}</label>
                <input
                  className={inputClass}
                  value={form.whatsapp}
                  onChange={(e) => setField("whatsapp", e.target.value)}
                  placeholder="+63 917 123 4567"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => goToStep(2)} className="text-sm text-gray-600">
                  ← Back
                </button>
                <button
                  onClick={() => goToStep(4)}
                  className="flex-1 rounded-card bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-dark transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ---- STEP 4: EMERGENCY CONTACT ---- */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-navy mb-1">
                Emergency Contact
              </h2>
              <div>
                <label className={labelClass}>Full Name{requiredMark}</label>
                <input
                  className={inputClass}
                  value={form.ecName}
                  onChange={(e) => setField("ecName", e.target.value)}
                  placeholder="Maria Santos"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Phone Number{requiredMark}</label>
                  <input
                    className={inputClass}
                    value={form.ecPhone}
                    onChange={(e) => setField("ecPhone", e.target.value)}
                    placeholder="+63 928 123 4567"
                  />
                </div>
                <div>
                  <label className={labelClass}>WhatsApp{requiredMark}</label>
                  <input
                    className={inputClass}
                    value={form.ecWhatsapp}
                    onChange={(e) => setField("ecWhatsapp", e.target.value)}
                    placeholder="+63 928 123 4567"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  Email <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.ecEmail}
                  onChange={(e) => setField("ecEmail", e.target.value)}
                  placeholder="maria@email.com"
                />
              </div>
              <div>
                <label className={labelClass}>Relationship{requiredMark}</label>
                <select
                  className={inputClass}
                  value={form.ecRelationship}
                  onChange={(e) => setField("ecRelationship", e.target.value)}
                >
                  <option value="">Select relationship</option>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => goToStep(3)} className="text-sm text-gray-600">
                  ← Back
                </button>
                <button
                  onClick={() => goToStep(5)}
                  className="flex-1 rounded-card bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-dark transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ---- STEP 5: DIVER DETAILS ---- */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-navy mb-1">Diver Details</h2>
              <div>
                <label className={labelClass}>Certification Level{requiredMark}</label>
                <select
                  className={inputClass}
                  value={form.certLevel}
                  onChange={(e) => setField("certLevel", e.target.value)}
                >
                  <option value="">Select certification</option>
                  {CERTIFICATION_LEVELS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              {form.certLevel && form.certLevel !== "None" && (
                <>
                  <div>
                    <label className={labelClass}>
                      Training Agency <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <select
                      className={inputClass}
                      value={form.agency}
                      onChange={(e) => setField("agency", e.target.value)}
                    >
                      <option value="">Select agency</option>
                      {TRAINING_AGENCIES.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Last Dive Date{requiredMark}</label>
                    <input
                      type="date"
                      className={inputClass}
                      max={new Date().toISOString().slice(0, 10)}
                      value={form.lastDiveDate}
                      onChange={(e) => setField("lastDiveDate", e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.nitroxCertified}
                      onChange={(e) => setField("nitroxCertified", e.target.checked)}
                    />
                    Nitrox certified
                  </label>
                </>
              )}
              <div>
                <label className={labelClass}>Logged Dives{requiredMark}</label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.loggedDives}
                  onChange={(e) => setField("loggedDives", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelClass}>
                  Food Allergies <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  className={inputClass}
                  value={form.foodAllergies}
                  onChange={(e) => setField("foodAllergies", e.target.value)}
                  placeholder="e.g. Shellfish, Nuts — or leave blank if none"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className={labelClass}>
                  Do you have dive insurance? <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setField("hasDiveInsurance", true)}
                    className={`flex-1 rounded-card border py-2 text-sm font-medium ${form.hasDiveInsurance === true ? "bg-navy text-white border-navy" : "border-gray-300"}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setField("hasDiveInsurance", false)}
                    className={`flex-1 rounded-card border py-2 text-sm font-medium ${form.hasDiveInsurance === false ? "bg-navy text-white border-navy" : "border-gray-300"}`}
                  >
                    No
                  </button>
                </div>
                {form.hasDiveInsurance === true && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Provider</label>
                      <input
                        className={inputClass}
                        value={form.insuranceProvider}
                        onChange={(e) => setField("insuranceProvider", e.target.value)}
                        placeholder="e.g. DAN, World Nomads"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Policy Number</label>
                      <input
                        className={inputClass}
                        value={form.insurancePolicyNumber}
                        onChange={(e) => setField("insurancePolicyNumber", e.target.value)}
                        placeholder="Policy #"
                      />
                    </div>
                  </div>
                )}
                {form.hasDiveInsurance === false && dc.offers_dive_insurance && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.wantsInsuranceReferral === true}
                      onChange={(e) => setField("wantsInsuranceReferral", e.target.checked)}
                    />
                    Would you like to get dive insurance?
                    {dc.insurance_referral_link && form.wantsInsuranceReferral && (
                      <a
                        href={dc.insurance_referral_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-mid underline"
                      >
                        Learn more
                      </a>
                    )}
                  </label>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => goToStep(4)} className="text-sm text-gray-600">
                  ← Back
                </button>
                <button
                  onClick={() => goToStep(6)}
                  className="flex-1 rounded-card bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-dark transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ---- STEP 6: EQUIPMENT ---- */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-navy mb-1">Equipment</h2>
              <label className={labelClass}>Do you need equipment?</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setField("needsEquipment", true)}
                  className={`flex-1 rounded-card border py-2 text-sm font-medium ${form.needsEquipment === true ? "bg-navy text-white border-navy" : "border-gray-300"}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setField("needsEquipment", false)}
                  className={`flex-1 rounded-card border py-2 text-sm font-medium ${form.needsEquipment === false ? "bg-navy text-white border-navy" : "border-gray-300"}`}
                >
                  No, I have my own
                </button>
              </div>

              {form.needsEquipment && (
                <div>
                  <label className={labelClass}>Select the gear you need</label>
                  <div className="space-y-2">
                    {(config.equipment_rental_rates ?? [])
                      .filter((r) => {
                        const n = r.item_name.toLowerCase();
                        return n !== "computer" && n !== "dive computer" && n !== "full set";
                      })
                      .map((r) => {
                        const key = r.item_name.toLowerCase();
                        return (
                          <label
                            key={r.id}
                            className="flex items-center gap-2 text-sm cursor-pointer border border-gray-200 rounded-card px-3 py-2"
                          >
                            <input
                              type="checkbox"
                              checked={!!form.equipmentSelections[key]}
                              onChange={(e) => setEquipmentSelection(key, e.target.checked)}
                            />
                            {r.item_name}
                          </label>
                        );
                      })}
                    {(config.equipment_rental_rates ?? []).length === 0 && (
                      <p className="text-xs text-gray-400">
                        No individual rental items configured. Please ask the dive center.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(() => {
                const computerRate = (config.equipment_rental_rates ?? []).find((r) =>
                  ["computer", "dive computer"].includes(r.item_name.toLowerCase()),
                );
                if (!computerRate) return null;
                return (
                  <label className="flex items-center gap-2 text-sm cursor-pointer border border-gray-200 rounded-card px-3 py-2">
                    <input
                      type="checkbox"
                      checked={form.wantsComputer}
                      onChange={(e) => setField("wantsComputer", e.target.checked)}
                    />
                    Computer Rental
                    <span className="text-gray-400 text-xs">
                      (₱{computerRate.rate.toLocaleString()}
                      {computerRate.charge_type === "per_day" ? " per day" : ""}, separate rental)
                    </span>
                  </label>
                );
              })()}

              <div className="flex gap-3 pt-2">
                <button onClick={() => goToStep(5)} className="text-sm text-gray-600">
                  ← Back
                </button>
                <button
                  onClick={() => goToStep(7)}
                  className="flex-1 rounded-card bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-dark transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ---- STEP 7: HEALTH DECLARATION ---- */}
          {step === 7 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-navy mb-1">Health Declaration</h2>
              {(config.medical_questions ?? []).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  No health questions configured for this dive center.
                </p>
              )}
              {(config.medical_questions ?? []).map((q) => (
                <div
                  key={q.id}
                  className="border border-gray-200 rounded-card p-3 flex items-center justify-between gap-3"
                >
                  <span className="text-sm">{q.question_text}</span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMedicalAnswer(q.id, true)}
                      className={`px-3 py-1.5 rounded-card text-xs font-medium border ${form.medicalAnswers[q.id] === true ? "bg-red text-white border-red" : "border-gray-300"}`}
                    >
                      ✓ Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setMedicalAnswer(q.id, false)}
                      className={`px-3 py-1.5 rounded-card text-xs font-medium border ${form.medicalAnswers[q.id] === false ? "bg-green text-white border-green" : "border-gray-300"}`}
                    >
                      ✕ No
                    </button>
                  </div>
                </div>
              ))}
              {anyMedicalYes() && (
                <div className="bg-orange-light text-orange text-xs rounded-card px-3 py-2">
                  Thanks for letting us know — the dive center team will follow
                  up with you about this before your dive.
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => goToStep(6)} className="text-sm text-gray-600">
                  ← Back
                </button>
                <button
                  onClick={() => goToStep(8)}
                  className="flex-1 rounded-card bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-dark transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ---- STEP 8: WAIVER & SIGNATURE ---- */}
          {step === 8 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-navy mb-1">
                Waiver &amp; Signature
              </h2>
              <div
                className="text-sm text-gray-700 max-h-56 overflow-y-auto border border-gray-200 rounded-card p-3"
                dangerouslySetInnerHTML={{
                  __html:
                    dc.waiver_content ||
                    '<span style="color:#94A3B8">This dive center has not yet added waiver text. Please contact them directly before your dive.</span>',
                }}
              />
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.waiverAgreed}
                  onChange={(e) => setField("waiverAgreed", e.target.checked)}
                  className="mt-0.5"
                />
                I have read and agree to the liability waiver above.
              </label>
              <div>
                <label className={labelClass}>Signature{requiredMark}</label>
                <SignaturePad onChange={(url) => setField("signatureDataUrl", url)} />
              </div>

              {submitError && <p className="text-sm text-red">{submitError}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => goToStep(7)} className="text-sm text-gray-600">
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-card bg-navy text-white py-2.5 text-sm font-medium hover:bg-navy-dark transition-colors disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit registration"}
                </button>
              </div>
            </div>
          )}

          {/* ---- STEP 9: CONFIRMATION ---- */}
          {step === 9 && confirmation && (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">✓</div>
              <h2 className="font-display text-xl text-navy mb-2">
                You&apos;re all set, {confirmation.firstName}!
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Your registration with {dc.name} is complete.
              </p>
              <div className="text-left text-sm bg-gray-100 rounded-card p-4 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Arrival</span>
                  <span>{confirmation.arrivalDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Departure</span>
                  <span>{confirmation.departureDate}</span>
                </div>
              </div>
              {confirmation.isMinor && (
                <p className="text-xs text-orange mt-4">
                  Additional documents may be needed during arrival since the
                  diver is under 18.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
