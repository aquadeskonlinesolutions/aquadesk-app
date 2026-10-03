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
        {/* Below lg, min-w-0 lets this column shrink to the screen so wide
            tables scroll inside their own containers instead of widening the
            page; lg:min-w-auto keeps the desktop layout exactly as before. */}
        <div className="flex-1 flex flex-col min-w-0 lg:min-w-auto">
          <main className="flex-1 p-4 sm:p-8 print:p-0">{children}</main>
        </div>
      </div>
    </UIProviders>
  );
}
