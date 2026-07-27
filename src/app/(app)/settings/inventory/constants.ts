// Pure constants shared by client components, data.ts, and actions.ts. Kept
// out of data.ts deliberately — data.ts is "server-only", and a client
// component importing a runtime value (not just a type) from it would pull
// the whole server-only module graph into the browser bundle and fail to
// build (same issue hit and fixed in settings/pricing).

export const TANK_TYPES: { label: string; value: string }[] = [
  { label: "Air 12L", value: "air_12l" },
  { label: "Air 15L", value: "air_15l" },
  { label: "Nitrox", value: "nitrox" },
];

export const GEAR_ITEMS = ["BCD", "Wetsuit", "Fins", "Boots", "Mask", "Regulator"];
