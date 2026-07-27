"use client";

import { useState, useTransition } from "react";
import { addDiverNote, deleteDiverNote } from "../actions";
import type { DiverNote } from "../data";

function fmtDateTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
  );
}

export function NotesPanel({
  diverId,
  initialNotes,
  isOwner,
}: {
  diverId: string;
  initialNotes: DiverNote[];
  isOwner: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addDiverNote(diverId, draft);
      if (res.error) {
        setError(res.error);
      } else {
        setNotes((prev) => [
          { id: crypto.randomUUID(), note: draft.trim(), authorName: "You", createdAt: new Date().toISOString() },
          ...prev,
        ]);
        setDraft("");
      }
    });
  }

  function remove(noteId: string) {
    setRowPending(noteId);
    startTransition(async () => {
      await deleteDiverNote(diverId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setRowPending(null);
    });
  }

  return (
    <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="text-sm font-extrabold text-navy">Notes</div>
        <div className="text-xs text-gray-500 mt-0.5">Internal notes about this diver.</div>
      </div>

      <div className="p-5 border-b border-gray-200">
        {error && <div className="text-sm text-red mb-2">{error}</div>}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note…"
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm min-h-[60px]"
        />
        <button
          onClick={submit}
          disabled={pending || !draft.trim()}
          className="mt-2 px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add Note"}
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {notes.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No notes yet.</div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{n.note}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {n.authorName} · {fmtDateTime(n.createdAt)}
                </div>
              </div>
              {isOwner && (
                <button
                  onClick={() => remove(n.id)}
                  disabled={pending && rowPending === n.id}
                  className="text-xs text-red hover:underline disabled:opacity-60 whitespace-nowrap"
                >
                  Delete
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
