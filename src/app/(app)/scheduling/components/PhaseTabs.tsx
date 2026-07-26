"use client";

export type Phase = "phase1" | "phase2" | "phase3";

export function PhaseTabs({
  phase,
  onChange,
  readOnly,
}: {
  phase: Phase;
  onChange: (p: Phase) => void;
  readOnly: boolean;
}) {
  const tabs: { id: Phase; label: string; disabled: boolean }[] = [
    { id: "phase1", label: "1. Prepare", disabled: readOnly },
    { id: "phase2", label: "2. Build", disabled: readOnly },
    { id: "phase3", label: readOnly ? "History" : "3. Complete", disabled: false },
  ];

  return (
    <div className="flex gap-1 border-b border-gray-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            phase === t.id
              ? "border-teal text-navy"
              : "border-transparent text-gray-600 hover:text-navy disabled:text-gray-300 disabled:hover:text-gray-300"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
