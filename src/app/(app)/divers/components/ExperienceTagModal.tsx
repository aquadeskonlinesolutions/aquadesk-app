"use client";

import { useState } from "react";
import type { CourseRateOption } from "../data";

export type PendingTag = {
  diverId: string;
  firstName: string;
  lastName: string;
  experienceType: "fun_diving" | "dive_course";
  courseRateId: string | null;
};

// Mirrors the live app's Experience Tagging modal (divers.html) — fresh
// implementation, not imported from Scheduling's own copy, per this
// codebase's established no-cross-page-action-imports convention.
export function ExperienceTagModal({
  divers,
  courseRates,
  onClose,
  onConfirm,
  pending,
}: {
  divers: { id: string; firstName: string; lastName: string }[];
  courseRates: CourseRateOption[];
  onClose: () => void;
  onConfirm: (tags: PendingTag[]) => void;
  pending: boolean;
}) {
  const [tags, setTags] = useState<Record<string, { experienceType: "fun_diving" | "dive_course"; courseRateId: string | null }>>(
    Object.fromEntries(divers.map((d) => [d.id, { experienceType: "fun_diving" as const, courseRateId: null }])),
  );

  function setAll(experienceType: "fun_diving" | "dive_course") {
    setTags((prev) => {
      const next = { ...prev };
      for (const d of divers) next[d.id] = { experienceType, courseRateId: next[d.id]?.courseRateId ?? null };
      return next;
    });
  }

  function confirm() {
    onConfirm(
      divers.map((d) => ({
        diverId: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        experienceType: tags[d.id].experienceType,
        courseRateId: tags[d.id].courseRateId,
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
          <p className="text-xs text-gray-500">Tag each diver so they can be added to today&apos;s schedule.</p>
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
            <div key={d.id} className="border border-gray-200 rounded-lg p-3 grid gap-2">
              <div className="text-sm font-medium text-navy">
                {d.firstName} {d.lastName}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={tags[d.id].experienceType}
                  onChange={(e) =>
                    setTags((prev) => ({
                      ...prev,
                      [d.id]: { ...prev[d.id], experienceType: e.target.value as "fun_diving" | "dive_course" },
                    }))
                  }
                  className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                >
                  <option value="fun_diving">🤿 Fun Diving</option>
                  <option value="dive_course">🎓 Course</option>
                </select>
                {tags[d.id].experienceType === "dive_course" && (
                  <select
                    value={tags[d.id].courseRateId ?? ""}
                    onChange={(e) =>
                      setTags((prev) => ({
                        ...prev,
                        [d.id]: { ...prev[d.id], courseRateId: e.target.value || null },
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
            disabled={pending}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-60"
          >
            {pending ? "Adding…" : `Add ${divers.length} Diver${divers.length === 1 ? "" : "s"} to Schedule`}
          </button>
        </div>
      </div>
    </div>
  );
}
