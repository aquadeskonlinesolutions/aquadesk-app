"use client";

import { useState, useTransition, useRef } from "react";
import { getTripsForDate, getManifestDetail, saveManifestFields } from "./actions";
import type { TripOption, ManifestDetail } from "./data";

const MIN_PASSENGER_ROWS = 32;

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return String(n) + (suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]);
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${mStr ?? "00"} ${ampm}`;
}

export function BoatManifestClient({
  initialDate,
  initialTrips,
}: {
  initialDate: string;
  initialTrips: TripOption[];
}) {
  const [date, setDate] = useState(initialDate);
  const [trips, setTrips] = useState(initialTrips);
  const [scheduleId, setScheduleId] = useState("");
  const [detail, setDetail] = useState<ManifestDetail | null>(null);
  const [district, setDistrict] = useState("");
  const [port, setPort] = useState("");
  const districtRef = useRef("");
  const portRef = useRef("");
  const [loadingTrips, startLoadingTrips] = useTransition();
  const [loadingDetail, startLoadingDetail] = useTransition();

  function handleDateChange(newDate: string) {
    setDate(newDate);
    setScheduleId("");
    setDetail(null);
    startLoadingTrips(async () => {
      const nextTrips = await getTripsForDate(newDate);
      setTrips(nextTrips);
    });
  }

  function handleSelectTrip(id: string) {
    setScheduleId(id);
    if (!id) {
      setDetail(null);
      return;
    }
    startLoadingDetail(async () => {
      const d = await getManifestDetail(id);
      setDetail(d);
      districtRef.current = d?.district ?? "";
      portRef.current = d?.port ?? "";
      setDistrict(d?.district ?? "");
      setPort(d?.port ?? "");
    });
  }

  function saveFields() {
    if (!scheduleId) return;
    saveManifestFields(scheduleId, districtRef.current, portRef.current);
    // Reflect the edit in the trip dropdown's "edited" indicator without a
    // full refetch — cheap local update, matches what the DB now holds.
    setTrips((current) =>
      current.map((t) => (t.scheduleId === scheduleId ? { ...t, hasManifestEdits: true } : t)),
    );
  }

  const scheduled = new Date(`${date}T00:00:00`);
  const dayLabel = isNaN(scheduled.getTime()) ? "__" : ordinal(scheduled.getDate());
  const monthLabel = isNaN(scheduled.getTime())
    ? "___"
    : scheduled.toLocaleDateString("en-PH", { month: "long", year: "numeric" });

  const passengerRows = detail
    ? [
        ...detail.passengers,
        ...Array.from(
          { length: Math.max(0, MIN_PASSENGER_ROWS - detail.passengers.length) },
          () => null,
        ),
      ]
    : [];

  return (
    <div>
      <div className="print:hidden flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-navy mb-1">Boat Manifest</h1>
          <p className="text-gray-600 text-sm">
            Bureau of Customs passenger manifest — pre-filled from scheduling
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => window.print()}
            disabled={!detail}
            className="px-5 py-2.5 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
          >
            🖨 Print Manifest
          </button>
          <span className="text-xs text-gray-400">
            Tip: turn off headers &amp; footers in the print dialog.
          </span>
        </div>
      </div>

      <div className="print:hidden bg-white border border-gray-200 rounded-card p-4 mb-4 flex gap-4 items-end flex-wrap">
        <div className="w-56">
          <label className="block text-sm font-semibold text-navy mb-1">Trip date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[280px]">
          <label className="block text-sm font-semibold text-navy mb-1">Select a trip</label>
          <select
            value={scheduleId}
            onChange={(e) => handleSelectTrip(e.target.value)}
            disabled={loadingTrips}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— Choose a trip —</option>
            {trips.map((t) => (
              <option key={t.scheduleId} value={t.scheduleId}>
                {t.boatName} — {t.siteLabel} — {formatTime(t.departureTime)}
                {t.hasManifestEdits ? " ✏️ edited" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!detail && !loadingDetail && (
        <div className="print:hidden bg-white border border-gray-200 rounded-card p-9 text-center text-gray-500">
          <div className="font-semibold text-navy mb-1">
            {scheduleId ? "Trip not found" : "No trip selected"}
          </div>
          <div>Pick a date, then choose a trip to generate its manifest.</div>
        </div>
      )}

      {detail && (
        <div className="bg-white border border-gray-200 rounded-card shadow-card p-10 max-w-4xl mx-auto text-black">
          <div className="text-center leading-relaxed mb-4">
            <div className="font-bold tracking-wide">REPUBLIC OF THE PHILIPPINES</div>
            <div className="font-semibold">DEPARTMENT OF FINANCE</div>
            <div className="font-extrabold text-base tracking-wide">BUREAU OF CUSTOMS</div>
          </div>

          <p className="text-center leading-loose text-sm max-w-2xl mx-auto mb-5">
            A complete list of all passengers taken on board in{" "}
            <span className="font-bold border-b border-black px-1">{detail.boatName}</span>{" "}
            sailing from the Port of{" "}
            <input
              placeholder="________________"
              className="border-0 border-b border-black outline-none font-semibold px-1 text-center min-w-[140px] inline-block bg-transparent"
            />{" "}
            Island on the{" "}
            <span className="font-bold border-b border-black px-1">{dayLabel}</span> day of{" "}
            <span className="font-bold border-b border-black px-1">{monthLabel}</span> for the
            port of{" "}
            <span className="font-bold border-b border-black px-1">{detail.siteLabel}</span>
          </p>

          <table className="w-full border-collapse text-[0.86rem] mb-5">
            <thead>
              <tr>
                <th className="border border-black bg-gray-100 p-1 w-10">No</th>
                <th className="border border-black bg-gray-100 p-1">Name</th>
                <th className="border border-black bg-gray-100 p-1 w-14">Age</th>
                <th className="border border-black bg-gray-100 p-1 w-14">Sex</th>
                <th className="border border-black bg-gray-100 p-1 w-32">Nationality</th>
                <th className="border border-black bg-gray-100 p-1">Place of Residence</th>
                <th className="border border-black bg-gray-100 p-1 w-16">Paying</th>
                <th className="border border-black bg-gray-100 p-1 w-20">Non-Paying</th>
              </tr>
            </thead>
            <tbody>
              {passengerRows.map((p, i) => (
                <tr key={p?.diverId ?? `blank-${i}`}>
                  <td className="border border-black p-1 text-center h-7">{i + 1}</td>
                  <td className="border border-black p-1">{p?.fullName ?? ""}</td>
                  <td className="border border-black p-1 text-center">{p?.age ?? ""}</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1">{p?.nationality ?? ""}</td>
                  <td className="border border-black p-1">{p?.residence ?? ""}</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1"></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="font-bold mb-2">
            DISTRICT OF{" "}
            <input
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                districtRef.current = e.target.value;
              }}
              onBlur={saveFields}
              placeholder="________________"
              className="border-0 border-b border-black outline-none font-semibold px-1 min-w-[220px] print:min-w-0"
            />
          </div>
          <div className="font-bold mb-4">
            PORT OF{" "}
            <input
              value={port}
              onChange={(e) => {
                setPort(e.target.value);
                portRef.current = e.target.value;
              }}
              onBlur={saveFields}
              placeholder="________________"
              className="border-0 border-b border-black outline-none font-semibold px-1 min-w-[220px] print:min-w-0"
            />
          </div>

          <p className="leading-loose text-sm">
            I{" "}
            <span className="font-bold border-b border-black px-1">
              {detail.captain || "________________"}
            </span>{" "}
            master of the{" "}
            <span className="font-bold border-b border-black px-1">{detail.boatName}</span> do
            solemnly swear that the following is full and complete manifest of all crews taken
            onboard said vessel on its present voyage, and statements contained therein are true
            and correct to the best of my knowledge and behalf.
          </p>

          <div className="mt-8 ml-auto mr-4 w-fit text-center">
            <div className="font-bold border-b border-black min-w-[260px] pb-1">
              {detail.captain || " "}
            </div>
            <div className="italic text-sm mt-1">Master</div>
          </div>

          <p className="mt-8 text-sm leading-loose">
            SUBSCRIBED AND SWORN to before me this{" "}
            <input
              placeholder="__________ day of _____________"
              className="border-0 border-b border-black outline-none font-semibold px-1 min-w-[280px]"
            />
          </p>

          <div className="mt-6 mr-4 text-right">
            <div className="font-bold border-b border-black inline-block min-w-[300px]">
              &nbsp;
            </div>
            <p className="text-sm mt-1 ml-auto w-1/2 text-right">
              Empowered to administer oath under the provision Section 1147 of the administrative
              code
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
