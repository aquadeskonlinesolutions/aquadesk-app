import { requireOwner } from "@/lib/dal";
import { loadWaiverData } from "./data";
import { WaiverEditorSection } from "./WaiverEditorSection";
import { MedicalQuestionsSection } from "./MedicalQuestionsSection";

export default async function SettingsWaiverPage() {
  const user = await requireOwner();
  const data = await loadWaiverData(user.diveCenterId);

  return (
    <div>
      <WaiverEditorSection
        waiverContent={data.waiverContent}
        waiverUpdatedAt={data.waiverUpdatedAt}
      />
      <MedicalQuestionsSection questions={data.medicalQuestions} />
    </div>
  );
}
