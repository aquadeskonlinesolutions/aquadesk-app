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
