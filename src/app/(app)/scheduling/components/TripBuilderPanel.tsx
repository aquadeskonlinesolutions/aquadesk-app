"use client";

import { useEffect, useState, useTransition } from "react";
import type { BoatOption, DiveSiteOption, TripDetail } from "../data";
import { createTrip, updateTrip, deleteTrip, cancelTrip, getTripDetail, type TripFormInput } from "../actions";
import { BOAT_MODE_OPTIONS } from "../constants";

function emptyForm(scheduleDate: string): TripFormInput {
  return {
    scheduleDate,
    boatMode: "own_boat",
    boatId: null,
    joinerBoatName: "",
    departureTime: "",
    siteIds: [],
    notes: "",
  };
}

function fromDetail(detail: TripDetail): TripFormInput {
  return {
    scheduleDate: detail.scheduleDate,
    boatMode: detail.isJoiner ? "join_ride" : "own_boat",
    boatId: detail.boatId,
    joinerBoatName: detail.joinerBoatName ?? "",
    departureTime: detail.departureTime ?? "",
    siteIds: detail.siteIds,
    notes: detail.notes ?? "",
  };
}

export function TripBuilderPanel({
  scheduleId,
  scheduleDate,
  boats,
  diveSites,
  onSaved,
  onDeletedOrCancelled,
}: {
  diveCenterId: string;
  scheduleId: string | null;
  scheduleDate: string;
  boats: BoatOption[];
  diveSites: DiveSiteOption[];
  onSaved: (scheduleId: string) => void;
  onDeletedOrCancelled: () => void;
}) {
  const [form, setForm] = useState<TripFormInput>(emptyForm(scheduleDate));
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(!!scheduleId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!scheduleId) return;
    getTripDetail(scheduleId).then((d) => {
      if (d) {
        setForm(fromDetail(d));
        setDetail(d);
      }
      setLoading(false);
    });
  }, [scheduleId]);

  const locked = detail?.closed ?? false;

  function save() {
    setError(null);
    startTransition(async () => {
      if (scheduleId) {
        const res = await updateTrip(scheduleId, form);
        if (res.error) setError(res.error);
        else onSaved(scheduleId);
      } else {
        const res = await createTrip(form);
        if (res.error) setError(res.error);
        else onSaved(res.scheduleId!);
      }
    });
  }

  function remove() {
    if (!scheduleId) return;
    if (!window.confirm("Delete this trip? This can't be undone.")) return;
    startTransition(async () => {
      const res = await deleteTrip(scheduleId);
      if (res.error) setError(res.error);
      else onDeletedOrCancelled();
    });
  }

  function cancel() {
    if (!scheduleId) return;
    if (!window.confirm("Cancel this trip? It stays on record but no longer counts as active.")) return;
    startTransition(async () => {
      const res = await cancelTrip(scheduleId);
      if (res.error) setError(res.error);
      else onDeletedOrCancelled();
    });
  }

  function toggleSite(siteId: string) {
    setForm((f) =>
      f.siteIds.includes(siteId)
        ? { ...f, siteIds: f.siteIds.filter((id) => id !== siteId) }
        : { ...f, siteIds: [...f.siteIds, siteId] },
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="text-sm font-semibold text-navy">
          {scheduleId ? "Edit Trip" : "New Trip"}
        </div>
        {detail?.cancelled && (
          <span className="text-xs bg-red/10 text-red px-2 py-0.5 rounded-full">Cancelled</span>
        )}
      </div>

      <div className="p-4 grid gap-4">
        {error && <div className="text-sm text-red">{error}</div>}
        {locked && (
          <div className="text-xs bg-teal/10 text-teal px-3 py-2 rounded-md">
            This trip is closed (boat returned) — fields are locked.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Departure Time</label>
            <input
              type="time"
              disabled={locked}
              value={form.departureTime}
              onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Boat</label>
            <select
              disabled={locked}
              value={form.boatMode}
              onChange={(e) => setForm({ ...form, boatMode: e.target.value as TripFormInput["boatMode"] })}
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
            >
              {BOAT_MODE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {form.boatMode === "own_boat" ? (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Which Boat</label>
              <select
                disabled={locked}
                value={form.boatId ?? ""}
                onChange={(e) => setForm({ ...form, boatId: e.target.value || null })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
              >
                <option value="">Select a boat…</option>
                {boats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.capacity ? ` (capacity ${b.capacity})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {form.boatMode === "rental" ? "Rental Boat Name" : "Their Boat Name"}
              </label>
              <input
                disabled={locked}
                value={form.joinerBoatName}
                onChange={(e) => setForm({ ...form, joinerBoatName: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
              />
            </div>
          )}

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Dive Sites</label>
            <div className="flex flex-wrap gap-2">
              {diveSites.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={locked}
                  onClick={() => toggleSite(s.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                    form.siteIds.includes(s.id)
                      ? "bg-navy text-white border-navy"
                      : "bg-white text-gray-600 border-gray-300"
                  } disabled:opacity-60`}
                >
                  {s.siteName}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              disabled={locked}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
        {scheduleId && !locked && (
          <>
            <button
              onClick={remove}
              disabled={pending}
              className="px-3 py-1.5 text-xs font-medium text-red border border-red/30 rounded-md hover:bg-red/5"
            >
              Delete
            </button>
            {!detail?.cancelled && (
              <button
                onClick={cancel}
                disabled={pending}
                className="px-3 py-1.5 text-xs font-medium text-navy border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Cancel Trip
              </button>
            )}
          </>
        )}
        {!locked && (
          <button
            onClick={save}
            disabled={pending}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save Trip"}
          </button>
        )}
      </div>
    </div>
  );
}
