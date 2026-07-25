"use client";

import { useState } from "react";
import { EXPERIENCE_TYPE_OPTIONS } from "../constants";
import type { CourseRateOption } from "../data";

export type PendingTag = {
  diverId: string;
  firstName: string;
  lastName: string;
  experienceType: "fun_diving" | "dive_course";
  courseRateId: string | null;
};

export function ExperienceTypeModal({
  divers,
  courseRates,
  onClose,
  onConfirm,
}: {
  divers: { diverId: string; firstName: string; lastName: string }[];
  courseRates: CourseRateOption[];
  onClose: () => void;
  onConfirm: (tags: PendingTag[]) => void;
}) {
  const [tags, setTags] = useState<Record<string, { experienceType: "fun_diving" | "dive_course"; courseRateId: string | null }>>(
    Object.fromEntries(divers.map((d) => [d.diverId, { experienceType: "fun_diving" as const, courseRateId: null }])),
  );

  function setAll(experienceType: "fun_diving" | "dive_course") {
    setTags((prev) => {
      const next = { ...prev };
      for (const d of divers) next[d.diverId] = { experienceType, courseRateId: next[d.diverId]?.courseRateId ?? null };
      return next;
    });
  }

  function confirm() {
    onConfirm(
      divers.map((d) => ({
        diverId: d.diverId,
        firstName: d.firstName,
        lastName: d.lastName,
        experienceType: tags[d.diverId].experienceType,
        courseRateId: tags[d.diverId].courseRateId,
      })),
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-lg text-navy">Tag Experience Type</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-6 grid gap-3">
          <p className="text-xs text-gray-500">
            These divers don&apos;t have an open visit yet — tag each one so it can be
            started.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setAll("fun_diving")}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Set all: Fun Diving
            </button>
            <button
              onClick={() => setAll("dive_course")}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Set all: Dive Course
            </button>
          </div>

          {divers.map((d) => (
            <div key={d.diverId} className="border border-gray-200 rounded-lg p-3 grid gap-2">
              <div className="text-sm font-medium text-navy">
                {d.firstName} {d.lastName}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={tags[d.diverId].experienceType}
                  onChange={(e) =>
                    setTags((prev) => ({
                      ...prev,
                      [d.diverId]: { ...prev[d.diverId], experienceType: e.target.value as "fun_diving" | "dive_course" },
                    }))
                  }
                  className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                >
                  {EXPERIENCE_TYPE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {tags[d.diverId].experienceType === "dive_course" && (
                  <select
                    value={tags[d.diverId].courseRateId ?? ""}
                    onChange={(e) =>
                      setTags((prev) => ({
                        ...prev,
                        [d.diverId]: { ...prev[d.diverId], courseRateId: e.target.value || null },
                      }))
                    }
                    className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                  >
                    <option value="">Select course…</option>
                    {courseRates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.courseName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={confirm}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark"
          >
            Add {divers.length} Diver{divers.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
