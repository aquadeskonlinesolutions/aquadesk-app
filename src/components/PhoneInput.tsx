"use client";

import { COUNTRY_CODES } from "@/lib/countryCodes";

const selectClass =
  "rounded-card border border-gray-300 pl-2 pr-1 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white";
const numberInputClass =
  "flex-1 rounded-card border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal";

export function PhoneInput({
  dialCode,
  number,
  onDialCodeChange,
  onNumberChange,
  placeholder,
}: {
  dialCode: string;
  number: string;
  onDialCodeChange: (v: string) => void;
  onNumberChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <select
        className={selectClass}
        value={dialCode}
        onChange={(e) => onDialCodeChange(e.target.value)}
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.iso2} value={c.dialCode}>
            {c.flag} {c.dialCode}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        className={numberInputClass}
        value={number}
        onChange={(e) => onNumberChange(e.target.value.replace(/[^\d]/g, ""))}
        placeholder={placeholder ?? "917 123 4567"}
      />
    </div>
  );
}
