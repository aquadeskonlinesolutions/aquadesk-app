"use server";

import { getCurrentUser } from "@/lib/dal";
import { searchDivers } from "./data";

export async function getDiversSearchResults(query: string) {
  const user = await getCurrentUser();
  return searchDivers(user.diveCenterId, query);
}
