import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CourseRate = {
  id: string;
  course_name: string;
  rate: number;
  is_active: boolean;
};

export type CoursesData = {
  courseRates: CourseRate[];
};

export async function loadCoursesData(diveCenterId: string): Promise<CoursesData> {
  const supabase = await createClient();
  const { data: courseRates } = await supabase
    .from("course_rates")
    .select("id, course_name, rate, is_active")
    .eq("dive_center_id", diveCenterId)
    .order("course_name");

  return { courseRates: courseRates ?? [] };
}
