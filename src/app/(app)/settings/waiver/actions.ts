"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { sanitizeWaiverHtmlServer } from "@/lib/sanitizeWaiverHtmlServer";

function ok() {
  revalidatePath("/settings/waiver");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

export async function saveWaiverContent(rawHtml: string) {
  const user = await requireOwner();
  const supabase = await createClient();

  const clean = sanitizeWaiverHtmlServer(rawHtml);

  const { error } = await supabase
    .from("dive_centers")
    .update({
      waiver_content: clean,
      waiver_updated_at: new Date().toISOString(),
      waiver_content_updated_by: user.id,
    })
    .eq("id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function saveMedicalQuestion(
  id: string | null,
  questionText: string,
  nextSortOrder: number,
) {
  const user = await requireOwner();
  if (!questionText.trim()) return fail("Question text is required.");
  const supabase = await createClient();

  const { error } = id
    ? await supabase
        .from("medical_questions")
        .update({ question_text: questionText.trim() })
        .eq("id", id)
    : await supabase.from("medical_questions").insert({
        dive_center_id: user.diveCenterId,
        question_text: questionText.trim(),
        sort_order: nextSortOrder,
        is_active: true,
      });
  if (error) return fail(error.message);
  return ok();
}

export async function deleteMedicalQuestion(id: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("medical_questions")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}
