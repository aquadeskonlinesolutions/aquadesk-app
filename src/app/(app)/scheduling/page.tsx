import { getCurrentUser } from "@/lib/dal";
import {
  loadTripsForDate,
  loadBoatOptions,
  loadDiveSiteOptions,
  loadStaffOptions,
  loadCourseRateOptions,
} from "./data";
import { SchedulingClient } from "./SchedulingClient";

function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function SchedulingPage() {
  const user = await getCurrentUser();
  const initialDate = todayManila();

  const [trips, boats, diveSites, staffOptions, courseRates] = await Promise.all([
    loadTripsForDate(user.diveCenterId, initialDate),
    loadBoatOptions(user.diveCenterId),
    loadDiveSiteOptions(user.diveCenterId),
    loadStaffOptions(user.diveCenterId),
    loadCourseRateOptions(user.diveCenterId),
  ]);

  return (
    <SchedulingClient
      diveCenterId={user.diveCenterId}
      initialDate={initialDate}
      initialTrips={trips}
      boats={boats}
      diveSites={diveSites}
      staffOptions={staffOptions}
      courseRates={courseRates}
    />
  );
}
