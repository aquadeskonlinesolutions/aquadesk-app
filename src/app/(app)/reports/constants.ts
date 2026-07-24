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
