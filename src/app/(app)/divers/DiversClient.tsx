"use client";

import { useState } from "react";
import type { CourseRateOption } from "./data";
import { GroupManagementTab } from "./components/GroupManagementTab";
import { IndividualManagementTab } from "./components/IndividualManagementTab";
import { EquipmentManagementTab } from "./components/EquipmentManagementTab";

type Mode = "group" | "individual" | "equipment";

const MODE_LABELS: Record<Mode, string> = {
  group: "Group Management",
  individual: "Individual Management",
  equipment: "Equipment Management",
};

const MODE_SUBTITLES: Record<Mode, string> = {
  group: "Create pre-arrival groups, share a registration link, or group divers together once they've arrived.",
  individual: "Find one diver at a time to check their bill, gear, or documents.",
  equipment: "See what gear each arriving diver needs, so nothing's missing when they show up.",
};

export function DiversClient({
  initialMode,
  initialEquipmentDate,
  courseRates,
  diveCenterId,
}: {
  initialMode: Mode;
  initialEquipmentDate: string | null;
  courseRates: CourseRateOption[];
  diveCenterId: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-3xl text-navy mb-1">{MODE_LABELS[mode]}</h1>
          <p className="text-gray-600 text-sm">{MODE_SUBTITLES[mode]}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-5 print:hidden">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === m ? "border-teal text-navy" : "border-transparent text-gray-600 hover:text-navy"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className={mode === "group" ? "" : "hidden"}>
        <GroupManagementTab courseRates={courseRates} diveCenterId={diveCenterId} active={mode === "group"} />
      </div>
      <div className={mode === "individual" ? "" : "hidden"}>
        <IndividualManagementTab courseRates={courseRates} active={mode === "individual"} />
      </div>
      <div className={mode === "equipment" ? "" : "hidden"}>
        <EquipmentManagementTab initialDate={initialEquipmentDate} />
      </div>
    </div>
  );
}
