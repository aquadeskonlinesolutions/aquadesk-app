"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { getDiversSearchResults } from "./actions";
import type { DiverListItem } from "./data";
import { CERT_LEVEL_LABELS } from "./constants";

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function DiversListClient({
  diveCenterId,
  initialDivers,
}: {
  diveCenterId: string;
  initialDivers: DiverListItem[];
}) {
  const [query, setQuery] = useState("");
  const [divers, setDivers] = useState(initialDivers);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSearching(false);
      setDivers(initialDivers);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        setDivers(await getDiversSearchResults(value.trim()));
      });
    }, 300);
  }

  return (
    <div className="grid gap-5">
      <div className="print:hidden flex items-start justify-between mb-1 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-navy mb-1">Diver Form</h1>
          <p className="text-gray-600 text-sm">Search every diver on file, or open a recent registration.</p>
        </div>
        <Link
          href={`/register?dc=${diveCenterId}`}
          target="_blank"
          className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors"
        >
          + Register New Diver
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search by name, email, phone, WhatsApp, or accommodation…"
            className="w-full px-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg outline-none focus:border-teal transition-colors"
          />
          {!searching && (
            <div className="text-xs text-gray-400 mt-2">
              {query.trim().length === 0 ? "Showing recently registered divers." : "Type at least 2 characters to search."}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Diver</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Contact</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Accommodation
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Latest Arrival
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {divers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                    {pending ? "Searching…" : "No divers found."}
                  </td>
                </tr>
              ) : (
                divers.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 last:border-0 hover:bg-off-white">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-navy">
                        {d.firstName} {d.lastName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {CERT_LEVEL_LABELS[d.certificationLevel] ?? d.certificationLevel}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {d.email || d.whatsapp || d.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{d.accommodation || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(d.latestArrivalDate)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/diver-form/${d.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-3.5 py-1.5 bg-navy text-white text-xs font-medium rounded-md hover:bg-navy-dark transition-colors whitespace-nowrap"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
