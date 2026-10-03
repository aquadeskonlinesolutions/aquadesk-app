import { requireRevenueAccess } from "@/lib/dal";
import { loadOverviewData, loadMonthlyFinancials, loadMonthlyFunVsCourseRevenue, loadTopNationalitiesYTD } from "./data";
import { ReportsClient } from "./ReportsClient";
import { manilaMonthRange } from "@/lib/manila";

// The current Asia/Manila month — not the server's (UTC on Cloudflare,
// which on the 1st before 08:00 Manila would still be last month).
function currentMonthRange(): { from: string; to: string } {
  return manilaMonthRange();
}

export default async function ReportsPage() {
  const user = await requireRevenueAccess();
  const { from, to } = currentMonthRange();
  const [overview, monthlyFinancials, monthlyFunVsCourse, nationalitiesYTD] = await Promise.all([
    loadOverviewData(user.diveCenterId, from, to),
    loadMonthlyFinancials(user.diveCenterId),
    loadMonthlyFunVsCourseRevenue(user.diveCenterId),
    loadTopNationalitiesYTD(user.diveCenterId),
  ]);

  return (
    <ReportsClient
      initialDateFrom={from}
      initialDateTo={to}
      initialOverview={overview}
      initialMonthlyFinancials={monthlyFinancials}
      initialMonthlyFunVsCourse={monthlyFunVsCourse}
      initialNationalitiesYTD={nationalitiesYTD}
      currentUserName={user.fullName}
    />
  );
}
