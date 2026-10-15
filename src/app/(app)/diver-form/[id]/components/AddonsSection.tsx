"use client";

import { useState, useTransition } from "react";
import { addVisitAddon, updateVisitAddon, deleteVisitAddon } from "../addonActions";
import type { AddonCategoryOption, VisitAddon } from "../data";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const ADD_CATEGORY_VALUE = "__add_category__";

function peso2(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Draft = { description: string; category: string; newCategory: string; amount: string };

const EMPTY: Draft = { description: "", category: "", newCategory: "", amount: "" };

// Same field styling as the Bill Summary's payment inputs.
const inputCls = "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm";

function AddonForm({
  draft,
  setDraft,
  categories,
  disabled,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  categories: AddonCategoryOption[];
  disabled: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
      <div className="sm:col-span-2 md:col-span-1">
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <input
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="e.g. Van transfer"
          maxLength={200}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          className={inputCls}
        >
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          <option value={ADD_CATEGORY_VALUE}>+ Add Category</option>
        </select>
        {draft.category === ADD_CATEGORY_VALUE && (
          <input
            value={draft.newCategory}
            onChange={(e) => setDraft({ ...draft, newCategory: e.target.value })}
            placeholder="New category name"
            maxLength={60}
            className={`${inputCls} mt-2`}
          />
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Amount (PHP)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={draft.amount}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
          placeholder="0.00"
          className={`${inputCls} text-right`}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={disabled}
          className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button onClick={onCancel} disabled={disabled} className="px-3 py-2 text-sm text-gray-600">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// The Bill Summary's Add-ons section (migration 059): visit-level extras on top
// of the activity subtotal. Add, edit and delete are available while the bill
// is open; the database refuses them on a closed bill (Unlock Bill first).
export function AddonsSection({
  diverId,
  visitId,
  addons,
  setAddons,
  categories,
  setCategories,
}: {
  diverId: string;
  visitId: string;
  addons: VisitAddon[];
  setAddons: React.Dispatch<React.SetStateAction<VisitAddon[]>>;
  categories: AddonCategoryOption[];
  setCategories: React.Dispatch<React.SetStateAction<AddonCategoryOption[]>>;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function check(d: Draft): { error: string } | { input: Parameters<typeof addVisitAddon>[2] } {
    if (!d.description.trim()) return { error: "Enter a description for the add-on." };
    if (!d.category) return { error: "Select a category." };
    if (d.category === ADD_CATEGORY_VALUE && !d.newCategory.trim()) return { error: "Enter a category name." };
    const amount = Number(d.amount);
    if (!d.amount.trim() || !Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount greater than 0." };
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return { error: "The amount can have at most 2 decimals." };
    return {
      input: {
        description: d.description,
        categoryId: d.category === ADD_CATEGORY_VALUE ? null : d.category,
        newCategoryLabel: d.category === ADD_CATEGORY_VALUE ? d.newCategory : null,
        amount,
      },
    };
  }

  function rememberCategory(c: AddonCategoryOption | undefined) {
    if (!c) return;
    setCategories((prev) =>
      prev.some((p) => p.id === c.id) ? prev : [...prev, c].sort((a, b) => a.label.localeCompare(b.label)),
    );
  }

  function add() {
    setError(null);
    const r = check(draft);
    if ("error" in r) return setError(r.error);
    startTransition(async () => {
      const res = await addVisitAddon(diverId, visitId, r.input);
      if (res.error || !res.addon) return setError(res.error ?? "Couldn't add the add-on.");
      rememberCategory(res.category);
      setAddons((prev) => [...prev, res.addon!]);
      setDraft(EMPTY);
    });
  }

  function startEdit(a: VisitAddon) {
    setError(null);
    setEditingId(a.id);
    setEditDraft({
      description: a.description,
      category: a.categoryId && categories.some((c) => c.id === a.categoryId) ? a.categoryId : "",
      newCategory: "",
      amount: String(a.amount),
    });
  }

  function saveEdit(id: string) {
    setError(null);
    const r = check(editDraft);
    if ("error" in r) return setError(r.error);
    startTransition(async () => {
      const res = await updateVisitAddon(diverId, visitId, id, r.input);
      if (res.error || !res.addon) return setError(res.error ?? "Couldn't save the add-on.");
      rememberCategory(res.category);
      setAddons((prev) => prev.map((x) => (x.id === id ? res.addon! : x)));
      setEditingId(null);
    });
  }

  async function remove(a: VisitAddon) {
    setError(null);
    const yes = await confirm(
      `Delete the add-on "${a.description}" (${peso2(a.amount)}) from this bill? The amount is taken off what the diver owes.`,
      { title: "Delete Add-on", confirmLabel: "Delete", danger: true, dismissible: true },
    );
    if (!yes) return;
    startTransition(async () => {
      const res = await deleteVisitAddon(diverId, visitId, a.id);
      if (res.error) return setError(res.error);
      setAddons((prev) => prev.filter((x) => x.id !== a.id));
      if (editingId === a.id) setEditingId(null);
    });
  }

  const total = addons.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="border-t border-gray-200 pt-4 grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Add-ons</div>
          <div className="text-xs text-gray-500 mt-0.5">Extras charged on this visit, on top of the activities.</div>
        </div>
        {addons.length > 0 && <div className="text-sm font-bold text-navy">{peso2(total)}</div>}
      </div>

      {error && <div className="text-sm text-red">{error}</div>}

      {addons.length > 0 && (
        <div className="grid gap-2">
          {addons.map((a) =>
            editingId === a.id ? (
              <div key={a.id} className="border border-teal/40 bg-teal-light/30 rounded-lg p-3">
                <AddonForm
                  draft={editDraft}
                  setDraft={setEditDraft}
                  categories={categories}
                  disabled={pending}
                  submitLabel="Save"
                  onSubmit={() => saveEdit(a.id)}
                  onCancel={() => {
                    setEditingId(null);
                    setError(null);
                  }}
                />
              </div>
            ) : (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-navy truncate">{a.description}</div>
                  <div className="text-xs text-gray-500">{a.categoryName}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="font-semibold text-navy">{peso2(a.amount)}</div>
                  <button
                    onClick={() => startEdit(a)}
                    disabled={pending}
                    className="text-sm font-medium text-teal-mid hover:underline disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(a)}
                    disabled={pending}
                    className="text-sm font-medium text-red hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <AddonForm
        draft={draft}
        setDraft={setDraft}
        categories={categories}
        disabled={pending}
        submitLabel="Add Add-on"
        onSubmit={add}
      />
    </div>
  );
}
