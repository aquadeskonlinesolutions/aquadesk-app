import Link from "next/link";
import { getCurrentPlatformAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { DiveCenterList } from "./DiveCenterList";
import { CreateDiveCenterForm } from "./CreateDiveCenterForm";

export default async function OfficePage() {
  const admin = await getCurrentPlatformAdmin();
  const supabase = await createClient();

  const { data: diveCenters } = await supabase
    .from("dive_centers")
    .select("id, name, email, phone, subscription_status, created_at")
    .order("created_at", { ascending: false });

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
