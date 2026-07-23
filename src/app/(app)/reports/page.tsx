import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export default async function ReportsPage() {
  const user = await getCurrentUser();

  // Optimistic UI check only — the real enforcement is the RLS revenue gate
  // on expenses/commissions/rental-gear/join-ride tables (Stage 1a).
  if (user.role !== "owner" && !user.canViewRevenue) {
    redirect("/dashboard");
  }

  return (
    <PagePlaceholder
      title="Reports"
      description="Revenue, expenses, commissions, and join-ride statements."
    />
  );
}
