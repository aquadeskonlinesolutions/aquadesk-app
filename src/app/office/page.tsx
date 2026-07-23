import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function OfficePage() {
  return (
    <div className="min-h-screen bg-off-white p-8 max-w-2xl mx-auto">
      <PagePlaceholder
        title="Admin Console"
        description="Platform admin: create dive centers, suspend accounts, manage billing status. Fully separate from the dive-center-facing app."
      />
    </div>
  );
}
