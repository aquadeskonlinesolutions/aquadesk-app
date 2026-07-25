"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { GroupListItem, DiverPickResult } from "../data";
import {
  getAllGroups,
  createRegistrationLinkGroup,
  createAdHocGroup,
  getGroupDeletionBlockers,
  deleteGroup,
  searchDivers,
} from "../actions";

function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function GroupsPanel({ onClose }: { onClose: () => void }) {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({
    groupName: "",
    leaderName: "",
    arrivalDate: "",
    departureDate: "",
    expectedCount: "",
    notes: "",
  });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const [showAdHocForm, setShowAdHocForm] = useState(false);
  const [adHocName, setAdHocName] = useState("");
  const [adHocQuery, setAdHocQuery] = useState("");
  const [adHocResults, setAdHocResults] = useState<DiverPickResult[]>([]);
  const [adHocSelected, setAdHocSelected] = useState<{ id: string; name: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refresh() {
    startTransition(async () => {
      setGroups(await getAllGroups());
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  function createLinkGroup() {
    setError(null);
    startTransition(async () => {
      const res = await createRegistrationLinkGroup(linkForm);
      if (res.error) {
        setError(res.error);
      } else {
        setGeneratedLink(res.registrationLink ?? null);
        refresh();
      }
    });
  }

  function onAdHocQueryChange(value: string) {
    setAdHocQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setAdHocResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        setAdHocResults(await searchDivers(value, todayManila(), null));
      });
    }, 300);
  }

  function addAdHocDiver(d: DiverPickResult) {
    if (adHocSelected.some((s) => s.id === d.id)) return;
    setAdHocSelected((prev) => [...prev, { id: d.id, name: `${d.firstName} ${d.lastName}` }]);
  }

  function createAdHoc() {
    setError(null);
    startTransition(async () => {
      const res = await createAdHocGroup(
        adHocName,
        adHocSelected.map((s) => s.id),
      );
      if (res.error) {
        setError(res.error);
      } else {
        setShowAdHocForm(false);
        setAdHocName("");
        setAdHocSelected([]);
        refresh();
      }
    });
  }

  function remove(groupId: string, groupName: string) {
    startTransition(async () => {
      const blockers = await getGroupDeletionBlockers(groupId);
      if (blockers.length > 0) {
        setError(
          `Can't delete "${groupName}" — ${blockers
            .map((b) => `${b.diverName} (${b.reasons.join(", ")})`)
            .join("; ")}.`,
        );
        return;
      }
      if (!window.confirm(`Delete "${groupName}"? This can't be undone.`)) return;
      const res = await deleteGroup(groupId);
      if (res.error) setError(res.error);
      else refresh();
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="text-sm font-semibold text-navy">Groups</div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
          ×
        </button>
      </div>

      <div className="p-4 grid gap-4">
        {error && <div className="text-sm text-red">{error}</div>}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowLinkForm((v) => !v)}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-navy text-white hover:bg-navy-dark"
          >
            + Registration Link Group
          </button>
          <button
            onClick={() => setShowAdHocForm((v) => !v)}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-teal text-white hover:bg-teal-mid"
          >
            + Ad-hoc Group
          </button>
        </div>

        {showLinkForm && (
          <div className="border border-gray-200 rounded-lg p-3 grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Group name"
                value={linkForm.groupName}
                onChange={(e) => setLinkForm({ ...linkForm, groupName: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs"
              />
              <input
                placeholder="Leader name"
                value={linkForm.leaderName}
                onChange={(e) => setLinkForm({ ...linkForm, leaderName: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs"
              />
              <input
                type="date"
                placeholder="Arrival"
                value={linkForm.arrivalDate}
                onChange={(e) => setLinkForm({ ...linkForm, arrivalDate: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs"
              />
              <input
                type="date"
                placeholder="Departure"
                value={linkForm.departureDate}
                onChange={(e) => setLinkForm({ ...linkForm, departureDate: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs"
              />
              <input
                type="number"
                placeholder="Expected count"
                value={linkForm.expectedCount}
                onChange={(e) => setLinkForm({ ...linkForm, expectedCount: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs"
              />
              <input
                placeholder="Notes"
                value={linkForm.notes}
                onChange={(e) => setLinkForm({ ...linkForm, notes: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs"
              />
            </div>
            <button
              onClick={createLinkGroup}
              disabled={pending}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-navy text-white hover:bg-navy-dark w-fit"
            >
              Create Group + Link
            </button>
            {generatedLink && (
              <div className="text-xs bg-off-white border border-gray-200 rounded-md p-2 break-all">
                {generatedLink}
              </div>
            )}
          </div>
        )}

        {showAdHocForm && (
          <div className="border border-gray-200 rounded-lg p-3 grid gap-2">
            <input
              placeholder="Group name"
              value={adHocName}
              onChange={(e) => setAdHocName(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs"
            />
            <input
              placeholder="Search divers to add…"
              value={adHocQuery}
              onChange={(e) => onAdHocQueryChange(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs"
            />
            {adHocResults.length > 0 && (
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {adHocResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addAdHocDiver(r)}
                    className="text-left px-2 py-1 text-xs rounded hover:bg-off-white"
                  >
                    {r.firstName} {r.lastName}
                  </button>
                ))}
              </div>
            )}
            {adHocSelected.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {adHocSelected.map((s) => (
                  <span key={s.id} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                    {s.name}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={createAdHoc}
              disabled={pending}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-teal text-white hover:bg-teal-mid w-fit"
            >
              Create Group ({adHocSelected.length} divers)
            </button>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4">No groups yet.</div>
        ) : (
          <div className="grid gap-2">
            {groups.map((g) => (
              <div
                key={g.id}
                className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-sm font-semibold text-navy">{g.groupName}</div>
                  <div className="text-xs text-gray-400">
                    {g.leaderName ? `${g.leaderName} · ` : ""}
                    {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                    {g.arrivalDate ? ` · arrives ${g.arrivalDate}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => remove(g.id, g.groupName)}
                  disabled={pending}
                  className="text-xs text-red hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
