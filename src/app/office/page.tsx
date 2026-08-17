import Link from "next/link";
import { getCurrentPlatformAdmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/lib/actions/auth";
import { DiveCenterList } from "./DiveCenterList";
import { CreateDiveCenterForm } from "./CreateDiveCenterForm";

export default async function OfficePage() {
  const admin = await getCurrentPlatformAdmin();
  // A platform admin's own session can't read users rows outside RLS's
  // dive_center_id scoping (current_dive_center_id() is null for platform
  // admins, since they have no public.users row) — the admin client is
  // needed here to embed each dive center's owner info, same reason
  // createDiveCenter already uses it.
  const supabase = createAdminClient();

  // dive_centers has two FK paths to users (the reverse
  // users.dive_center_id relation, and dive_centers.waiver_content_updated_by
  // -> users.id) — PostgREST can't infer which one without a hint, and
  // silently returns an error (not a thrown exception) when ambiguous,
  // which the destructured `data` alone doesn't surface. Disambiguate
  // explicitly and alias back to `users` for DiveCenterList's prop shape.
  const { data: diveCenters, error: diveCentersError } = await supabase
    .from("dive_centers")
    .select(
      "id, name, email, phone, address, subscription_status, billing_due_date, billing_amount, last_payment_date, paddle_subscription_id, paddle_customer_id, created_at, users:users!users_dive_center_id_fkey(id, full_name, email, is_active, locked_until, role)",
    )
    .order("created_at", { ascending: false });

  if (diveCentersError) {
    console.error("Failed to load dive centers:", diveCentersError.message);
  }

  return (
    <div className="min-h-screen bg-off-white">
      <header className="h-16 bg-navy text-white flex items-center justify-between px-8">
        <span className="font-display text-xl">
          AquaDesk <span className="text-teal">Admin Console</span>
        </span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-white/70">{admin.fullName}</span>
          <Link href="/account/password" className="hover:underline">
            Change password
          </Link>
          <form action={signOut}>
            <button className="hover:underline">Sign out</button>
          </form>
        </div>
      </header>

      <main className="p-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-2xl text-navy mb-1">
            Dive Centers
          </h1>
          <p className="text-gray-600 text-sm mb-4">
            Create dive centers, manage billing status. This tier never
            touches diver, scheduling, or payment data — that boundary is
            enforced by the database itself, not just this page.
          </p>
          <DiveCenterList diveCenters={diveCenters ?? []} />
        </div>

        <CreateDiveCenterForm />
      </main>
    </div>
  );
}
