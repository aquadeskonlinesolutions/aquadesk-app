import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DiveSite = {
  id: string;
  site_name: string;
  distance: string | null;
  fuel_estimate: string;
  shark_fee: boolean;
  linked_package_id: string | null;
  is_active: boolean;
};

export type PackageOption = {
  id: string;
  package_name: string;
};

export type DiveSitesData = {
  diveSites: DiveSite[];
  packages: PackageOption[];
  pricingMode: string | null;
};

export async function loadDiveSitesData(diveCenterId: string): Promise<DiveSitesData> {
  const supabase = await createClient();

  const [{ data: diveSites }, { data: packages }, { data: dc }] = await Promise.all([
    supabase
      .from("dive_sites")
      .select("id, site_name, distance, fuel_estimate, shark_fee, linked_package_id, is_active")
      .eq("dive_center_id", diveCenterId)
      .order("site_name"),
    supabase
      .from("packages")
      .select("id, package_name")
      .eq("dive_center_id", diveCenterId)
      .order("package_name"),
    supabase
      .from("dive_centers")
      .select("pricing_mode")
      .eq("id", diveCenterId)
      .single(),
  ]);

  return {
    diveSites: diveSites ?? [],
    packages: packages ?? [],
    pricingMode: dc?.pricing_mode ?? null,
  };
}
