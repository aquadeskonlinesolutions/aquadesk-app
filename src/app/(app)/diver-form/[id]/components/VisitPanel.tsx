"use client";

import { useRef, useState, useTransition } from "react";
import {
  createVisit,
  addActivityRow,
  saveActivityRow,
  deleteActivityRow,
  voidVisit,
  applyChargesToVisit,
  type ActivityFields,
} from "../actions";
import type { Activity, Visit, CourseRateOption } from "../data";
import { useToast } from "@/components/ui/Toast";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`;
}

function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const STATUS_OPTIONS: Activity["status"][] = ["planned", "scheduled", "ongoing", "completed", "cancelled"];

function toFields(a: Activity): ActivityFields {
  return {
    date: a.date,
    diveSite: a.diveSite ?? "",
    staffName: a.staffName ?? "",
    diveRate: a.diveRate,
    fuelSurcharge: a.fuelSurcharge,
    marineTax: a.marineTax,
    sharkFee: a.sharkFee,
    nitroxFee: a.nitroxFee,
    fifteenLFee: a.fifteenLFee,
    equipmentRental: a.equipmentRental,
    addons: a.addons,
    discount: a.discount,
    status: a.status,
  };
}

// Matches diver-form.html's real buildActivityRow()/updateActivity()/
// saveActivity(): edits persist immediately (no manual per-row Save step,
// no per-row Auto-Price — the live app has neither), and the row shows no
// per-row Total or Discount column at all (discount is the whole-bill
// field in BillSummary.tsx; total is only ever shown once, at the Visit
// Total footer). Committing on blur/select-change rather than the live
// app's literal oninput-per-keystroke achieves the same "no button"
// result without a network write on every keystroke.
function ActivityRow({
  diverId,
  activity,
  onChanged,
  onDeleted,
}: {
  diverId: string;
  activity: Activity;
  onChanged: (a: Activity) => void;
  onDeleted: (id: string) => void;
}) {
  const [fields, setFields] = useState<ActivityFields>(toFields(activity));
  const fieldsRef = useRef(fields);
  const [pending, startTransition] = useTransition();

  function updateLocal(patch: Partial<ActivityFields>) {
    setFields((f) => {
      const next = { ...f, ...patch };
      fieldsRef.current = next;
      return next;
    });
  }

  function commit(nextFields: ActivityFields) {
    startTransition(async () => {
      const res = await saveActivityRow(diverId, activity.id, nextFields);
      if (!res.error) {
        const computedTotal =
          nextFields.diveRate +
          nextFields.fuelSurcharge +
          nextFields.marineTax +
          nextFields.sharkFee +
          nextFields.nitroxFee +
          nextFields.fifteenLFee +
          nextFields.equipmentRental +
          nextFields.addons -
          nextFields.discount;
        onChanged({
          ...activity,
          date: nextFields.date,
          diveSite: nextFields.diveSite || null,
          staffName: nextFields.staffName || null,
          diveRate: nextFields.diveRate,
          fuelSurcharge: nextFields.fuelSurcharge,
          marineTax: nextFields.marineTax,
          sharkFee: nextFields.sharkFee,
          nitroxFee: nextFields.nitroxFee,
          fifteenLFee: nextFields.fifteenLFee,
          equipmentRental: nextFields.equipmentRental,
          addons: nextFields.addons,
          discount: nextFields.discount,
          status: nextFields.status,
          total: computedTotal,
        });
      }
    });
  }

  function commitOnBlur() {
    commit(fieldsRef.current);
  }

  function commitSelect(patch: Partial<ActivityFields>) {
    const next = { ...fieldsRef.current, ...patch };
    fieldsRef.current = next;
    setFields(next);
    commit(next);
  }

  function remove() {
    startTransition(async () => {
      await deleteActivityRow(diverId, activity.id);
      onDeleted(activity.id);
    });
  }

  const numInput = (value: number, onChange: (v: number) => void) => (
    <input
      type="number"
      step="0.01"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      onBlur={commitOnBlur}
      className="w-20 border border-gray-300 rounded-md px-1.5 py-1 text-xs text-right"
    />
  );

  const locked = !!activity.scheduleId;

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-2 py-2">
        <input
          type="date"
          value={fields.date}
          onChange={(e) => updateLocal({ date: e.target.value })}
          onBlur={commitOnBlur}
          className="w-32 border border-gray-300 rounded-md px-1.5 py-1 text-xs"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={fields.diveSite}
          onChange={(e) => updateLocal({ diveSite: e.target.value })}
          onBlur={commitOnBlur}
          placeholder="Dive site"
          className="w-28 border border-gray-300 rounded-md px-1.5 py-1 text-xs"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={fields.staffName}
          onChange={(e) => updateLocal({ staffName: e.target.value })}
          onBlur={commitOnBlur}
          placeholder="Staff"
          className="w-24 border border-gray-300 rounded-md px-1.5 py-1 text-xs"
        />
      </td>
      <td className="px-2 py-2">{numInput(fields.diveRate, (v) => updateLocal({ diveRate: v }))}</td>
      <td className="px-2 py-2">{numInput(fields.fuelSurcharge, (v) => updateLocal({ fuelSurcharge: v }))}</td>
      <td className="px-2 py-2">{numInput(fields.marineTax, (v) => updateLocal({ marineTax: v }))}</td>
      <td className="px-2 py-2">{numInput(fields.sharkFee, (v) => updateLocal({ sharkFee: v }))}</td>
      <td className="px-2 py-2">{numInput(fields.nitroxFee, (v) => updateLocal({ nitroxFee: v }))}</td>
      <td className="px-2 py-2">{numInput(fields.fifteenLFee, (v) => updateLocal({ fifteenLFee: v }))}</td>
      <td className="px-2 py-2">{numInput(fields.equipmentRental, (v) => updateLocal({ equipmentRental: v }))}</td>
      <td className="px-2 py-2">{numInput(fields.addons, (v) => updateLocal({ addons: v }))}</td>
      <td className="px-2 py-2">
        <select
          value={fields.status}
          onChange={(e) => commitSelect({ status: e.target.value as Activity["status"] })}
          className="border border-gray-300 rounded-md px-1.5 py-1 text-xs"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2 text-center">
        {locked ? (
          <span
            title="Created from Scheduling — cancel instead of deleting"
            className="text-gray-300 cursor-not-allowed"
          >
            🔒
          </span>
        ) : (
          <button
            onClick={remove}
            disabled={pending}
            title="Delete"
            className="text-red hover:opacity-70 disabled:opacity-40"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}

export function VisitPanel({
  diverId,
  visit,
  setVisit,
  activities,
  setActivities,
  courseRates,
}: {
  diverId: string;
  visit: Visit | null;
  setVisit: (v: Visit | null) => void;
  activities: Activity[];
  setActivities: (updater: Activity[] | ((prev: Activity[]) => Activity[])) => void;
  courseRates: CourseRateOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [choosingCourse, setChoosingCourse] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(courseRates[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const showToast = useToast();

  function startNewVisit(experienceType: "fun_diving" | "dive_course", courseRateId: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await createVisit(diverId, experienceType, courseRateId);
      if (res.error) {
        setError(res.error);
      } else {
        const course = courseRateId ? courseRates.find((c) => c.id === courseRateId) : null;
        setVisit({
          id: res.visitId!,
          experienceType,
          visitStart: todayManila(),
          visitEnd: null,
          visitStatus: "open",
          isActive: true,
          invoiceCount: 0,
          courseRateId: courseRateId ?? null,
          courseName: course?.courseName ?? null,
        });
        setActivities([]);
        setChoosingCourse(false);
      }
    });
  }

  function addRow() {
    if (!visit) return;
    setError(null);
    startTransition(async () => {
      const res = await addActivityRow(diverId, visit.id, todayManila());
      if (res.error) {
        setError(res.error);
        return;
      }
      // Re-fetch isn't wired here to keep this a pure client add — assign a
      // temporary local id via crypto.randomUUID and let the next full page
      // load reconcile it; simplest correct approach given no realtime feed.
      window.location.reload();
    });
  }

  function handleVoid() {
    if (!visit) return;
    setError(null);
    startTransition(async () => {
      const res = await voidVisit(diverId, visit.id);
      if (res.error) {
        setError(res.error);
      } else {
        setVisit(null);
        setActivities([]);
      }
    });
  }

  // Matches diver-form.html's "↺ Apply Charges" — recomputes every
  // non-cancelled row's dive rate/fees at once (retroactive tier count,
  // per-day cadence dedup, nitrox/15L from each row's own stored flags).
  // Reloads afterward, same as Add Activity/bill-unlock — this affects
  // every row at once, not one piece of local state to hand-patch.
  function applyCharges() {
    if (!visit) return;
    setError(null);
    startTransition(async () => {
      const res = await applyChargesToVisit(diverId, visit.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.missingRateCount) {
        showToast(
          `Charges applied. ${res.missingRateCount} row(s) have no configured dive rate — enter those manually.`,
          "error",
        );
        // Give the toast a moment on screen before the reload wipes it —
        // unlike the window.alert() it replaces, a toast doesn't block.
        setTimeout(() => window.location.reload(), 1800);
      } else {
        window.location.reload();
      }
    });
  }

  const grandTotal = activities
    .filter((a) => a.status !== "cancelled")
    .reduce((s, a) => s + a.total, 0);

  if (!visit) {
    return (
      <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <div className="text-sm font-extrabold text-navy mb-3">Visit</div>
        {error && <div className="text-sm text-red mb-3">{error}</div>}
        <div className="text-sm text-gray-500 mb-3">No open visit. Start one to log dives or a course.</div>
        {!choosingCourse ? (
          <div className="flex gap-2">
            <button
              onClick={() => startNewVisit("fun_diving", null)}
              disabled={pending}
              className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-60"
            >
              Start Fun Diving Visit
            </button>
            <button
              onClick={() => setChoosingCourse(true)}
              disabled={pending || courseRates.length === 0}
              title={courseRates.length === 0 ? "No courses configured in Settings > Courses" : undefined}
              className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-60"
            >
              Start Course Visit
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            >
              {courseRates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseName} ({peso(c.rate)})
                </option>
              ))}
            </select>
            <button
              onClick={() => startNewVisit("dive_course", selectedCourseId)}
              disabled={pending}
              className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-60"
            >
              Start
            </button>
            <button onClick={() => setChoosingCourse(false)} className="px-3 py-2 text-sm text-gray-600">
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  const isEditable = visit.isActive && visit.visitStatus === "open";

  return (
    <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-extrabold text-navy">
            {visit.experienceType === "dive_course" ? `Course Visit — ${visit.courseName ?? "no course"}` : "Fun Diving Visit"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Started {visit.visitStart} · {visit.visitStatus}
            {!isEditable && " (read-only — visit is closed)"}
          </div>
        </div>
        {isEditable && (
          <div className="flex gap-2">
            <button
              onClick={addRow}
              disabled={pending}
              className="px-3 py-1.5 text-xs font-medium bg-teal text-white rounded-md hover:bg-teal-mid disabled:opacity-60"
            >
              + Add Activity
            </button>
            {activities.length > 0 && (
              <button
                onClick={applyCharges}
                disabled={pending}
                className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark disabled:opacity-60"
              >
                ↺ Apply Charges
              </button>
            )}
            {activities.length === 0 && (
              <button
                onClick={handleVoid}
                disabled={pending}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 text-red rounded-md hover:bg-gray-50 disabled:opacity-60"
              >
                Void Visit
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className="px-5 py-3 text-sm text-red">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Date</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Site</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Staff</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Dive</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Fuel</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Marine</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Shark</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Nitrox</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">15L</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Equip.</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Addons</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Status</th>
              <th className="px-2 py-2 text-xs font-semibold uppercase text-gray-400 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-8 text-gray-400 text-sm">
                  No activities logged yet.
                </td>
              </tr>
            ) : (
              activities.map((a) =>
                isEditable ? (
                  <ActivityRow
                    key={a.id}
                    diverId={diverId}
                    activity={a}
                    onChanged={(updated) =>
                      setActivities((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                    }
                    onDeleted={(id) => setActivities((prev) => prev.filter((x) => x.id !== id))}
                  />
                ) : (
                  <tr key={a.id} className="border-b border-gray-100 last:border-0 text-xs">
                    <td className="px-2 py-2">{a.date}</td>
                    <td className="px-2 py-2">{a.diveSite || "—"}</td>
                    <td className="px-2 py-2">{a.staffName || "—"}</td>
                    <td className="px-2 py-2">{peso(a.diveRate)}</td>
                    <td className="px-2 py-2">{peso(a.fuelSurcharge)}</td>
                    <td className="px-2 py-2">{peso(a.marineTax)}</td>
                    <td className="px-2 py-2">{peso(a.sharkFee)}</td>
                    <td className="px-2 py-2">{peso(a.nitroxFee)}</td>
                    <td className="px-2 py-2">{peso(a.fifteenLFee)}</td>
                    <td className="px-2 py-2">{peso(a.equipmentRental)}</td>
                    <td className="px-2 py-2">{peso(a.addons)}</td>
                    <td className="px-2 py-2">{a.status}</td>
                    <td className="px-2 py-2"></td>
                  </tr>
                ),
              )
            )}
          </tbody>
          {activities.length > 0 && (
            <tfoot>
              <tr className="bg-navy text-white font-extrabold">
                <td className="px-2 py-2" colSpan={12}>
                  Visit Total
                </td>
                <td className="px-2 py-2 text-right">{peso(grandTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
