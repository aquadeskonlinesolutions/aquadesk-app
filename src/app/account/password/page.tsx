import { PagePlaceholder } from "@/components/PagePlaceholder";

export default function AccountPasswordPage() {
  return (
    <div className="min-h-screen bg-off-white p-8 max-w-md mx-auto">
      <PagePlaceholder
        title="Set / Reset Password"
        description="One screen, two entry states: first-time set vs. reset."
      />
    </div>
  );
}
