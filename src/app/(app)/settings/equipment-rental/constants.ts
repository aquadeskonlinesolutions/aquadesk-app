// Pure constants shared by client components and Server Actions. Kept out of
// data.ts deliberately — data.ts is "server-only", and any client component
// importing a runtime value (not just a type) from it would pull the whole
// server-only module graph (createClient, next/headers) into the browser
// bundle and fail to build.

export const DEFAULT_EQUIPMENT_ITEMS = [
  "BCD",
  "Wetsuit",
  "Fins",
  "Mask",
  "Boots",
  "Regulator",
  "Weights",
  "Full Set",
  "Torch",
  "Snorkel",
  "Dive Computer",
];
