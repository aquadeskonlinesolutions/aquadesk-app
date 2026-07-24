"use server";

import { requireRevenueAccess } from "@/lib/dal";
import { loadOverviewData } from "./data";

export async function getOverviewData(dateFrom: string, dateTo: string) {
  const user = await requireRevenueAccess();
  return loadOverviewData(user.diveCenterId, dateFrom, dateTo);
}
