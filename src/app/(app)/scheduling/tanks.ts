// Shared, pure tank-tally math used by both TripCard.tsx (Build-phase live
// tally) and PhaseThreePanel.tsx (Complete-phase summary) — previously
// these two disagreed with each other because each had its own
// independently-wrong computation. Matches scheduling.html's real
// calcTanksForTrip(): one tank per diver per dive site (not per diver),
// plus one tank per staff/team member per dive site (nitrox if flagged for
// that site, otherwise plain air — staff never get 15L).

export type TankTally = { air12l: number; air15l: number; nitrox: number };

export function computeTankTally(params: {
  siteCount: number;
  diverTanks: { siteIndex: number; tankType: "nitrox" | "air_15l" }[][];
  staffNitroxSiteIndexesByTeam: number[][];
}): TankTally {
  const { siteCount, diverTanks, staffNitroxSiteIndexesByTeam } = params;
  let air12l = 0;
  let air15l = 0;
  let nitrox = 0;

  diverTanks.forEach((tanks) => {
    for (let si = 0; si < siteCount; si++) {
      const match = tanks.find((t) => t.siteIndex === si);
      if (match?.tankType === "nitrox") nitrox++;
      else if (match?.tankType === "air_15l") air15l++;
      else air12l++;
    }
  });

  staffNitroxSiteIndexesByTeam.forEach((indexes) => {
    for (let si = 0; si < siteCount; si++) {
      if (indexes.includes(si)) nitrox++;
      else air12l++;
    }
  });

  return { air12l, air15l, nitrox };
}

export function formatTankLine(t: TankTally): string {
  return `Air 12L ${t.air12l} · Air 15L ${t.air15l} · Nitrox ${t.nitrox}`;
}
