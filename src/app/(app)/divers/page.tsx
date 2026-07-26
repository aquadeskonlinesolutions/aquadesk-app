import { getCurrentUser } from "@/lib/dal";
import { loadCourseRateOptions } from "./data";
import { DiversClient } from "./DiversClient";

export default async function DiversPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const courseRates = await loadCourseRateOptions(user.diveCenterId);

  return (
    <DiversClient
      initialMode={params.mode === "equipment" ? "equipment" : "group"}
      initialEquipmentDate={params.date ?? null}
      courseRates={courseRates}
      diveCenterId={user.diveCenterId}
    />
  );
}
