"use client";

import { useState, useTransition } from "react";
import { SettingsSection, InfoBox } from "@/components/settings/SettingsSection";
import { saveMedicalQuestion, deleteMedicalQuestion } from "./actions";
import type { MedicalQuestion } from "./data";

export function MedicalQuestionsSection({
  questions,
}: {
  questions: MedicalQuestion[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setText("");
    setError(null);
  }
  function startEdit(q: MedicalQuestion) {
    setEditingId(q.id);
    setAdding(false);
    setText(q.question_text);
    setError(null);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }
  function save() {
    const nextSortOrder = questions.length
      ? Math.max(...questions.map((q) => q.sort_order)) + 1
      : 0;
    startTransition(async () => {
      const res = await saveMedicalQuestion(editingId, text, nextSortOrder);
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
      await deleteMedicalQuestion(id);
    });
  }

  return (
    <SettingsSection
      title="Medical Questions"
      subtitle="Each question appears as a Yes/No question in the diver registration form"
      action={
        !adding && (
          <button
            onClick={startAdd}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Question
          </button>
        )
      }
    >
      <InfoBox>
        🚨 If a diver answers <strong>Yes</strong> to any question, they are
        flagged in red on the whiteboard. The secretary must acknowledge the
        flag before proceeding.
      </InfoBox>
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      {(adding || editingId) && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-off-white rounded-lg border border-gray-200">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Question Text
            </label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
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

      {questions.length === 0 && !adding ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No medical questions yet. Add your first question.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {questions.map((q) => (
            <div
              key={q.id}
              className="flex items-start gap-4 px-4 py-3 border border-gray-200 rounded-lg"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-dark">{q.question_text}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Renders as: <strong>Yes / No</strong> in registration form
                </div>
              </div>
              <button
                onClick={() => startEdit(q)}
                className="text-xs text-teal hover:text-navy shrink-0"
              >
                Edit
              </button>
              <button
                onClick={() => remove(q.id)}
                className="text-xs text-red hover:underline shrink-0"
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
