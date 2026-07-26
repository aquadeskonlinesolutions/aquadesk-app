"use client";

import { useState } from "react";
import Link from "next/link";
import type { ActiveDiverRow } from "./data";

function peso(amount: number): string {
  return `₱${Math.round(amount).toLocaleString()}`;
}

export function DiversTable({ divers }: { divers: ActiveDiverRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = divers.filter((d) =>
    `${d.name} ${d.groupName ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div>
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search diver by name..."
          className="w-full px-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg outline-none focus:border-teal transition-colors"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Diver
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Trip Type
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Bill
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">
                  <div className="text-3xl mb-2 opacity-40">🤿</div>
                  {divers.length === 0
                    ? "No active divers today"
                    : "No divers match your search"}
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-100"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-navy">{d.name}</div>
                    <div className="text-xs text-gray-400">
                      {d.certLevel}
                      {d.groupName ? ` · ${d.groupName}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        d.status === "Ongoing"
                          ? "bg-orange-light text-orange"
                          : "bg-green-light text-green"
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm font-medium">
                    {d.tripType}
                  </td>
                  <td className="px-4 py-3">
                    {d.total > 0 ? (
                      <>
                        <div className="font-semibold text-navy">
                          {peso(d.total)}
                        </div>
                        <div className="text-xs text-red">
                          Balance: {peso(d.balance)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold text-navy">₱0</div>
                        <div className="text-xs text-gray-400">No bill yet</div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/diver-form/${d.id}`}
                      className="inline-block px-3.5 py-1.5 bg-navy text-white text-xs font-medium rounded-md hover:bg-navy-dark transition-colors whitespace-nowrap"
                    >
                      Open Form
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
