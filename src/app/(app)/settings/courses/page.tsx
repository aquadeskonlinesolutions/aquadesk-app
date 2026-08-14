import { requireOwner } from "@/lib/dal";
import { loadCoursesData } from "./data";
import { CourseRatesSection } from "./CourseRatesSection";
import { BundlesSection } from "./BundlesSection";

export default async function SettingsCoursesPage() {
  const user = await requireOwner();
  const data = await loadCoursesData(user.diveCenterId);

  return (
    <div className="flex flex-col gap-6">
      <CourseRatesSection courses={data.courseRates} />
      <BundlesSection bundles={data.bundles} />
    </div>
  );
}
