import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { SettingsTabs } from "@/components/SettingsTabs";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Optimistic UI check only — the real enforcement is the RLS owner-write
  // policy on every settings/pricing/staff-management table (Stage 1a).
  if (user.role !== "owner") {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-navy mb-6">Settings</h1>
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
