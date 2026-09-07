import { getCurrentUser } from "@/lib/dal";
import { Sidebar } from "@/components/Sidebar";
import { UIProviders } from "@/components/ui/UIProviders";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <UIProviders>
      <div className="flex min-h-screen bg-off-white print:block">
        <div className="print:hidden">
          <Sidebar user={user} />
        </div>
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-8 print:p-0">{children}</main>
        </div>
      </div>
    </UIProviders>
  );
}
