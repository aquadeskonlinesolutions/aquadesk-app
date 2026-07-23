import { getCurrentUser } from "@/lib/dal";
import { Sidebar } from "@/components/Sidebar";
import { signOut } from "@/lib/actions/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen bg-off-white">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col">
        <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center justify-end px-6">
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm font-medium text-gray-600 hover:text-navy transition-colors"
            >
              Sign out
            </button>
          </form>
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
