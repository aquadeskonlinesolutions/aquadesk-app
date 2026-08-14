import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CourseRate = {
  id: string;
  course_name: string;
  rate: number;
  is_active: boolean;
  equipment_included: boolean;
};

export type Bundle = {
  id: string;
  name: string;
  dive_count: number;
  price: number;
  equipment_included: boolean;
  is_active: boolean;
};

export type CoursesData = {
  courseRates: CourseRate[];
  bundles: Bundle[];
};

export async function loadCoursesData(diveCenterId: string): Promise<CoursesData> {
  const supabase = await createClient();
  const [{ data: courseRates }, { data: bundles }] = await Promise.all([
    supabase
      .from("course_rates")
      .select("id, course_name, rate, is_active, equipment_included")
      .eq("dive_center_id", diveCenterId)
      .order("course_name"),
    supabase
      .from("bundles")
      .select("id, name, dive_count, price, equipment_included, is_active")
      .eq("dive_center_id", diveCenterId)
      .order("dive_count"),
  ]);

  return { courseRates: courseRates ?? [], bundles: bundles ?? [] };
}
