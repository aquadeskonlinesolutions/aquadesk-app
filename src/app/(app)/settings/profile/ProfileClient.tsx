"use client";

import { useRef, useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "./actions";

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

export function ProfileClient({
  diveCenterId,
  name: initialName,
  email: initialEmail,
  phone: initialPhone,
  address: initialAddress,
  logoUrl: initialLogoUrl,
  subscriptionStatus,
}: {
  diveCenterId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  logoUrl: string | null;
  subscriptionStatus: string;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  // Refs mirrored alongside every setState — Save must always read the
  // value just typed/picked, even if it fires before React commits the
  // preceding state update (this codebase's standing defensive pattern for
  // any "type/pick then Save" flow, not just merged-object state).
  const nameRef = useRef(name);
  const emailRef = useRef(email);
  const phoneRef = useRef(phone);
  const addressRef = useRef(address);
  const logoFileRef = useRef(logoFile);
  const logoUrlRef = useRef(logoUrl);

  function onLogoPicked(file: File | null) {
    logoFileRef.current = file;
    setLogoFile(file);
    setSuccess(false);
    if (file) setLogoPreview(URL.createObjectURL(file));
  }

  function save() {
    startTransition(async () => {
      setError(null);

      let finalLogoUrl = logoUrlRef.current;
      const file = logoFileRef.current;
      if (file) {
        const ext = file.name.split(".").pop() || "png";
        const path = `logos/${diveCenterId}.${ext}`;
        const supabase = createClient();
        const { error: uploadErr } = await supabase.storage
          .from("dive-center-assets")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadErr) {
          setError(`Could not upload logo: ${uploadErr.message}`);
          return;
        }
        const { data: urlData } = supabase.storage.from("dive-center-assets").getPublicUrl(path);
        finalLogoUrl = urlData?.publicUrl ?? finalLogoUrl;
        logoUrlRef.current = finalLogoUrl;
        setLogoUrl(finalLogoUrl);
      }

      const res = await updateProfile({
        name: nameRef.current,
        email: emailRef.current,
        phone: phoneRef.current,
        address: addressRef.current,
        logoUrl: finalLogoUrl,
      });

      if (res.error) {
        setError(res.error);
        setSuccess(false);
      } else {
        setSuccess(true);
        logoFileRef.current = null;
        setLogoFile(null);
      }
    });
  }

  return (
    <SettingsSection
      title="Dive Center Profile"
      subtitle="Basic information shown across the system and on diver-facing pages"
      action={
        <button
          onClick={save}
          disabled={pending}
          className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Profile"}
        </button>
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}
      {success && <div className="mb-3 text-sm text-green">Saved.</div>}

      <div className="mb-5 flex items-center gap-4">
        <div className="w-18 h-18 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0" style={{ width: 72, height: 72 }}>
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🏢</span>
          )}
        </div>
        <div>
          <label className="inline-block px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
            Upload Logo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onLogoPicked(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="text-xs text-gray-400 mt-1">PNG or JPG, recommended 200×200px</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dive Center Name <span className="text-red">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => {
              nameRef.current = e.target.value;
              setName(e.target.value);
              setSuccess(false);
            }}
            placeholder="e.g. Malapascua Divers"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              emailRef.current = e.target.value;
              setEmail(e.target.value);
              setSuccess(false);
            }}
            placeholder="info@yourdivecenter.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              phoneRef.current = e.target.value;
              setPhone(e.target.value);
              setSuccess(false);
            }}
            placeholder="+63 917 123 4567"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            value={address}
            onChange={(e) => {
              addressRef.current = e.target.value;
              setAddress(e.target.value);
              setSuccess(false);
            }}
            placeholder="Malapascua Island, Cebu, Philippines"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Status</label>
        <input
          readOnly
          value={SUBSCRIPTION_LABELS[subscriptionStatus] ?? subscriptionStatus}
          className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-default"
        />
        <div className="text-xs text-gray-400 mt-1">Contact AquaDesk support to change your subscription plan.</div>
      </div>
    </SettingsSection>
  );
}
