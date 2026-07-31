"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { DiverCard as DiverCardType, CourseRateOption } from "../data";
import {
  getRecentDiverCards,
  searchDivers,
  createAdHocGroup,
  addDiversToSchedule,
  removeDiver,
  acknowledgeMedical,
} from "../actions";
import { DiverCard } from "./DiverCard";
import { ExperienceTagModal, type PendingTag } from "./ExperienceTagModal";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export function IndividualManagementTab({
  courseRates,
  active,
}: {
  courseRates: CourseRateOption[];
  active: boolean;
}) {
  const [cards, setCards] = useState<DiverCardType[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupingSelected, setGroupingSelected] = useState<{ id: string; name: string }[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingTagDivers, setPendingTagDivers] = useState<DiverCardType[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = useConfirm();

  function load() {
    startTransition(async () => setCards(await getRecentDiverCards()));
  }

  // Same reasoning as GroupManagementTab's `active` refetch — this tab
  // stays mounted across tab switches, so it must explicitly reload
  // whenever it becomes visible again to pick up changes made elsewhere
  // (e.g. Group Management deleting a group this diver belonged to).
  useEffect(() => {
    if (active && query.trim().length < 2) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      load();
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => setCards(await searchDivers(value)));
    }, 300);
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleGrouping(card: DiverCardType) {
    setGroupingSelected((prev) => {
      if (prev.some((s) => s.id === card.id)) return prev.filter((s) => s.id !== card.id);
      return [...prev, { id: card.id, name: `${card.firstName} ${card.lastName}` }];
    });
  }

  function createGroupFromSelection() {
    if (!newGroupName.trim() || groupingSelected.length < 2) return;
    startTransition(async () => {
      const res = await createAdHocGroup(newGroupName, groupingSelected.map((s) => s.id));
      if (res.error) setError(res.error);
      else {
        setShowGroupModal(false);
        setNewGroupName("");
        setGroupingSelected([]);
        load();
      }
    });
  }

  function openAddToSchedule() {
    setPendingTagDivers(cards.filter((c) => selected.has(c.id)));
  }

  function confirmAddToSchedule(tags: PendingTag[]) {
    startTransition(async () => {
      const res = await addDiversToSchedule(
        tags.map((t) => ({ diverId: t.diverId, experienceType: t.experienceType, courseRateId: t.courseRateId })),
      );
      if (res.error) setError(res.error);
      else {
        setPendingTagDivers(null);
        setSelected(new Set());
        load();
      }
    });
  }

  async function removeCard(diverId: string, name: string) {
    const ok = await confirm(
      `Remove ${name}? This deletes their diver record entirely and cannot be undone. If this was a mistake, they'll need to re-register.`,
      { danger: true },
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await removeDiver(diverId);
      if (res.error) setError(res.error);
      else load();
    });
  }

  function ackMedical(diverId: string) {
    startTransition(async () => {
      await acknowledgeMedical(diverId);
      load();
    });
  }

  return (
    <div className="grid gap-4">
      {error && <div className="text-sm text-red bg-red-light rounded-md px-3 py-2">{error}</div>}

      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search name, group, accommodation…"
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
      />

      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-off-white rounded-md px-3 py-2">
          <span className="text-xs text-gray-600">{selected.size} selected</span>
          <button
            onClick={openAddToSchedule}
            className="px-3 py-1 text-xs font-medium rounded-md bg-teal text-white hover:bg-teal-mid"
          >
            Add to Schedule
          </button>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">
          {query.trim().length >= 1 && query.trim().length < 2
            ? "Type at least 2 characters to search."
            : "No divers found."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <DiverCard
              key={c.id}
              card={c}
              variant="individual"
              selected={selected.has(c.id)}
              onToggleSelect={(checked) => toggleSelect(c.id, checked)}
              showRemove
              onRemove={() => removeCard(c.id, `${c.firstName} ${c.lastName}`)}
              onAcknowledgeMedical={() => ackMedical(c.id)}
              showGroupButton={!c.groupId}
              onAddToGroupSelection={() => toggleGrouping(c)}
            />
          ))}
        </div>
      )}

      {groupingSelected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-navy text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-4 z-30">
          <span className="text-sm">{groupingSelected.length} selected for a new group</span>
          <button
            onClick={() => setShowGroupModal(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-full bg-teal text-white hover:bg-teal-mid"
          >
            Create Group
          </button>
          <button onClick={() => setGroupingSelected([])} className="text-xs text-white/70 hover:text-white">
            Clear
          </button>
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6 grid gap-3">
            <div className="font-display text-lg text-navy">Create Group</div>
            <div className="text-xs text-gray-500">{groupingSelected.map((s) => s.name).join(", ")}</div>
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowGroupModal(false)} className="px-4 py-2 text-sm text-gray-600">
                Cancel
              </button>
              <button
                onClick={createGroupFromSelection}
                disabled={pending || !newGroupName.trim()}
                className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-60"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingTagDivers && (
        <ExperienceTagModal
          divers={pendingTagDivers}
          courseRates={courseRates}
          pending={pending}
          onClose={() => setPendingTagDivers(null)}
          onConfirm={confirmAddToSchedule}
        />
      )}
    </div>
  );
}
