import type { RosterData } from "../data";
import { nationalityAdjective, certLevelShort, diverExperienceLine } from "../rosterFormat";

// Print-only — hidden on screen (`hidden print:block`), shown only once
// SchedulingClient's Print Roster button has loaded data and triggered
// window.print(). Same on-screen-hidden / print-only split as
// reports/SettlementTab.tsx's own print table.
export function RosterPrintView({ data }: { data: RosterData }) {
  return (
    <div className="hidden print:block p-6">
      <div className="font-display text-2xl text-navy mb-1">{data.diveCenterName} — Diver Roster</div>
      <div className="text-sm text-gray-600 mb-4">
        Printed: {new Date().toLocaleString()} &nbsp;·&nbsp; {data.divers.length} active diver
        {data.divers.length === 1 ? "" : "s"}
      </div>
      <table className="w-full text-sm border border-gray-300">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="px-2 py-1.5 border-b border-gray-300">Diver</th>
            <th className="px-2 py-1.5 border-b border-gray-300">Nationality</th>
            <th className="px-2 py-1.5 border-b border-gray-300">Age</th>
            <th className="px-2 py-1.5 border-b border-gray-300">Cert</th>
            <th className="px-2 py-1.5 border-b border-gray-300 text-right">Logged Dives</th>
            <th className="px-2 py-1.5 border-b border-gray-300">Group</th>
            <th className="px-2 py-1.5 border-b border-gray-300">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.divers.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-2 py-4 text-center text-gray-400">
                No active divers.
              </td>
            </tr>
          ) : (
            data.divers.map((d) => (
              <tr key={d.id}>
                <td className="px-2 py-1.5 border-b border-gray-100 font-semibold text-navy">
                  {d.firstName} {d.lastName}
                </td>
                <td className="px-2 py-1.5 border-b border-gray-100">{nationalityAdjective(d.nationality)}</td>
                <td className="px-2 py-1.5 border-b border-gray-100">{d.age ?? "—"}</td>
                <td className="px-2 py-1.5 border-b border-gray-100">{certLevelShort(d.certificationLevel)}</td>
                <td className="px-2 py-1.5 border-b border-gray-100 text-right">{d.loggedDives}</td>
                <td className="px-2 py-1.5 border-b border-gray-100">
                  {d.groupName ? `${d.groupName}${d.leaderName ? ` (Leader: ${d.leaderName})` : ""}` : "—"}
                </td>
                <td className="px-2 py-1.5 border-b border-gray-100">
                  {diverExperienceLine(d.experienceType, d.courseName)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
