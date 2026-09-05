// Common rental gear types, offered as quick-pick suggestions in the Rental
// Gears form. Unlike the live app's rigid <select>, this is paired with a
// free-text input (via <datalist>) — the live app's dropdown has no "type
// your own" option, so editing a record whose equipment name isn't in the
// preset list silently falls back to a bare "Other" and loses the original
// text the next time it's saved.
export const EQUIPMENT_SUGGESTIONS = [
  "Air Tank 12L",
  "Air Tank 15L",
  "Nitrox Tank",
  "BCD",
  "Regulator",
  "Wetsuit",
  "Fins",
  "Mask",
  "Computer",
];

// Matches the `expense_category` Postgres enum exactly (database/001_schema_and_rls.sql).
// Shared between the server-only data loader (category label lookup) and the
// client form (select options) — a pure constant, safe for both.
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  fuel: "Fuel",
  boat_maintenance: "Boat Maintenance",
  equipment_maintenance: "Equipment Maintenance",
  compressor_fill_station: "Compressor / Fill Station",
  staff_meals: "Staff Meals",
  food_expenses: "Food Expenses",
  office_supplies: "Office Supplies",
  utilities: "Utilities",
  licenses_permits: "Licenses & Permits",
  marketing: "Marketing",
  repairs: "Repairs",
  other: "Other",
  uncategorized: "Uncategorized",
};

// Matches the public.payment_method Postgres enum exactly (already used by
// deposits.method) — reused here for expenses.payment_method rather than a
// dedicated enum, per the user's own choice.
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  online: "Online",
};

// The 12 real, still-selectable base categories — every EXPENSE_CATEGORY_LABELS
// key except 'uncategorized', which is retired from the dropdown (replaced by
// "+ Add Category") but kept in the labels map so historical rows still
// resolve to a real label. Shared between the client dropdown and the
// server's dedup-match-against-base-categories check, so the two never drift.
export const BASE_EXPENSE_CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS).filter(
  ([key]) => key !== "uncategorized",
);

// Sentinel <select> value for "+ Add Category" — never stored, only used
// client-side to know when to reveal the new-category text input.
export const ADD_CATEGORY_VALUE = "__add_category__";
