// Pure constants shared by client components and Server Actions. Kept out of
// data.ts deliberately — data.ts is "server-only", and any client component
// importing a runtime value (not just a type) from it would pull the whole
// server-only module graph (createClient, next/headers) into the browser
// bundle and fail to build.

export const DEFAULT_COURSES = [
  { name: "Open Water Diver", rate: 19500 },
  { name: "Advanced Open Water", rate: 16500 },
  { name: "Rescue Diver", rate: 11000 },
  { name: "Divemaster", rate: 100000 },
  { name: "Instructor", rate: 150000 },
  { name: "Nitrox", rate: 11000 },
  { name: "Deep Dive Specialty", rate: 11000 },
];

export const DEFAULT_CHARGES: { name: string; subType: string | null }[] = [
  { name: "Marine Tax", subType: null },
  { name: "Shark Fee", subType: null },
  { name: "Fuel Charge — Medium", subType: "medium" },
  { name: "Fuel Charge — High", subType: "high" },
];

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

export const DEFAULT_CURRENCIES = [
  { code: "USD", name: "US Dollar", flag: "🇺🇸", rate: 57.0 },
  { code: "EUR", name: "Euro", flag: "🇪🇺", rate: 62.0 },
  { code: "AUD", name: "Australian Dollar", flag: "🇦🇺", rate: 38.0 },
  { code: "GBP", name: "British Pound", flag: "🇬🇧", rate: 72.0 },
  { code: "JPY", name: "Japanese Yen", flag: "🇯🇵", rate: 0.38 },
  { code: "KRW", name: "Korean Won", flag: "🇰🇷", rate: 0.043 },
  { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳", rate: 7.9 },
  { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬", rate: 43.0 },
  { code: "HKD", name: "Hong Kong Dollar", flag: "🇭🇰", rate: 7.3 },
  { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", rate: 65.0 },
  { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", rate: 42.0 },
  { code: "NZD", name: "New Zealand Dollar", flag: "🇳🇿", rate: 35.0 },
];
