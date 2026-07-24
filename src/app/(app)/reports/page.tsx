import { requireRevenueAccess } from "@/lib/dal";
import { loadOverviewData } from "./data";
import { ReportsClient } from "./ReportsClient";

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  return { from, to };
}

export default async function ReportsPage() {
  const user = await requireRevenueAccess();
  const { from, to } = currentMonthRange();
  const overview = await loadOverviewData(user.diveCenterId, from, to);

  return (
    <ReportsClient
      initialDateFrom={from}
      initialDateTo={to}
      initialOverview={overview}
      currentUserName={user.fullName}
    />
  );
}
