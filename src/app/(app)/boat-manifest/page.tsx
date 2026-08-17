import { requireBoatManifestEnabled } from "@/lib/dal";
import { loadTripsForDate } from "./data";
import { BoatManifestClient } from "./BoatManifestClient";

function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function BoatManifestPage() {
  const user = await requireBoatManifestEnabled();
  const today = todayManila();
  const trips = await loadTripsForDate(user.diveCenterId, today);

  return <BoatManifestClient initialDate={today} initialTrips={trips} />;
}
