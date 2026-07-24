import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MedicalQuestion = {
  id: string;
  question_text: string;
  sort_order: number;
};

export type WaiverData = {
  waiverContent: string;
  waiverUpdatedAt: string | null;
  medicalQuestions: MedicalQuestion[];
};

export async function loadWaiverData(diveCenterId: string): Promise<WaiverData> {
  const supabase = await createClient();

  const [{ data: dc }, { data: questions }] = await Promise.all([
    supabase
      .from("dive_centers")
      .select("waiver_content, waiver_updated_at")
      .eq("id", diveCenterId)
      .single(),
    supabase
      .from("medical_questions")
      .select("id, question_text, sort_order")
      .eq("dive_center_id", diveCenterId)
      .order("sort_order"),
  ]);

  return {
    waiverContent: dc?.waiver_content ?? "",
    waiverUpdatedAt: dc?.waiver_updated_at ?? null,
    medicalQuestions: questions ?? [],
  };
}
