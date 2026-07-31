"use client";

export type Phase = "phase1" | "phase2" | "phase3";

// Matches scheduling.html's real filled pill tabs (navy when active,
// each with a sub-label — "Phase 1 / Prepare divers" etc.), not a plain
// underline-tab idiom.
export function PhaseTabs({
  phase,
  onChange,
  readOnly,
}: {
  phase: Phase;
  onChange: (p: Phase) => void;
  readOnly: boolean;
}) {
  const tabs: { id: Phase; title: string; sub: string; disabled: boolean }[] = [
    { id: "phase1", title: "Phase 1", sub: "Prepare divers", disabled: readOnly },
    { id: "phase2", title: "Phase 2", sub: "Build trips", disabled: readOnly },
    { id: "phase3", title: "Phase 3", sub: readOnly ? "History" : "Final schedule", disabled: false },
  ];

  return (
    <div className="flex gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 rounded-lg text-left border transition-colors ${
            phase === t.id
              ? "bg-navy text-white border-navy"
              : "bg-white text-navy border-gray-200 hover:border-navy/40 disabled:text-gray-300 disabled:hover:border-gray-200"
          }`}
        >
          <div className="text-xs font-extrabold leading-none">{t.title}</div>
          <div className={`text-xs mt-1 ${phase === t.id ? "text-white/70" : "text-gray-400"}`}>{t.sub}</div>
        </button>
      ))}
    </div>
  );
}
