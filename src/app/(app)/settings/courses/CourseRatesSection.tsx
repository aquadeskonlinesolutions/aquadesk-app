"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveCourseRate, deleteCourseRate } from "./actions";
import type { CourseRate } from "./data";

function peso(n: number) {
  return `₱${n.toLocaleString()}`;
}

export function CourseRatesSection({ courses }: { courses: CourseRate[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setName("");
    setPrice("");
    setError(null);
  }
  function startEdit(c: CourseRate) {
    setEditingId(c.id);
    setAdding(false);
    setName(c.course_name);
    setPrice(String(c.rate));
    setError(null);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }
  function save() {
    startTransition(async () => {
      const res = await saveCourseRate(editingId, name, parseFloat(price) || 0);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setAdding(false);
        setEditingId(null);
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      await deleteCourseRate(id);
    });
  }

  return (
    <SettingsSection
      title="Course Rates"
      subtitle="Fixed prices for all dive courses — not affected by pricing mode"
      action={
        !adding && (
          <button
            onClick={startAdd}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Course
          </button>
        )
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      {(adding || editingId) && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-off-white rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Course Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Price (PHP)
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-32"
            />
          </div>
          <button
            onClick={save}
            disabled={pending}
            className="px-3 py-1.5 text-sm font-medium bg-teal text-white rounded-md hover:bg-teal-mid disabled:opacity-60"
          >
            Save
          </button>
          <button onClick={cancel} className="px-3 py-1.5 text-sm text-gray-600">
            Cancel
          </button>
        </div>
      )}

      {courses.length === 0 && !adding ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No courses yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {courses.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 px-4 py-3 border border-gray-200 rounded-lg"
            >
              <div className="flex-1 font-medium text-navy">{c.course_name}</div>
              <div className="font-semibold text-navy">{peso(c.rate)}</div>
              <button
                onClick={() => startEdit(c)}
                className="text-xs text-teal hover:text-navy"
              >
                Edit
              </button>
              <button
                onClick={() => remove(c.id)}
                className="text-xs text-red hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
