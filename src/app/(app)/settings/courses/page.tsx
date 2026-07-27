import { requireOwner } from "@/lib/dal";
import { loadCoursesData } from "./data";
import { CourseRatesSection } from "./CourseRatesSection";

export default async function SettingsCoursesPage() {
  const user = await requireOwner();
  const data = await loadCoursesData(user.diveCenterId);

  return (
    <div>
      <CourseRatesSection courses={data.courseRates} />
    </div>
  );
}
