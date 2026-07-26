import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StaffPosition = "secretary" | "divemaster" | "instructor" | "crew";
export type EmploymentStatus = "full_time" | "part_time" | "freelance";

export type StaffMember = {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  position: StaffPosition;
  employmentStatus: EmploymentStatus | null;
  dateHired: string | null;
  dailyRate: number | null;
  nitroxCertified: boolean;
  isActive: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactWhatsapp: string | null;
  emergencyContactEmail: string | null;
};

export type StaffCertification = {
  id: string;
  staffId: string;
  certName: string;
  expiryDate: string | null;
};

export type UnlinkedSecretary = {
  id: string;
  fullName: string;
  email: string;
};

export type StaffPageData = {
  roster: StaffMember[];
  certifications: StaffCertification[];
  unlinkedSecretaries: UnlinkedSecretary[];
};

function mapStaff(row: Record<string, unknown>): StaffMember {
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    whatsapp: (row.whatsapp as string) ?? null,
    position: row.position as StaffPosition,
    employmentStatus: (row.employment_status as EmploymentStatus) ?? null,
    dateHired: (row.date_hired as string) ?? null,
    dailyRate: row.daily_rate === null ? null : Number(row.daily_rate),
    nitroxCertified: row.nitrox_certified as boolean,
    isActive: row.is_active as boolean,
    emergencyContactName: (row.emergency_contact_name as string) ?? null,
    emergencyContactPhone: (row.emergency_contact_phone as string) ?? null,
    emergencyContactRelationship: (row.emergency_contact_relationship as string) ?? null,
    emergencyContactWhatsapp: (row.emergency_contact_whatsapp as string) ?? null,
    emergencyContactEmail: (row.emergency_contact_email as string) ?? null,
  };
}

// Settings is owner-only at the layout level, so unlike the old top-level
// Staff page this never needs to branch on role — every caller here is an
// owner. Secretary self-view (a rebuild-only addition with no live-app
// precedent) was dropped when this moved into Settings, per the user's
// explicit choice to match the live app exactly.
export async function loadStaffPageData(diveCenterId: string): Promise<StaffPageData> {
  const supabase = await createClient();

  const [{ data: staffRows }, { data: certRows }, { data: secretaries }, { data: linkedStaff }] = await Promise.all([
    supabase.from("staff").select("*").eq("dive_center_id", diveCenterId).order("first_name"),
    supabase
      .from("staff_certifications")
      .select("id, staff_id, cert_name, expiry_date")
      .eq("dive_center_id", diveCenterId)
      .order("expiry_date"),
    supabase.from("users").select("id, full_name, email").eq("dive_center_id", diveCenterId).eq("role", "secretary"),
    supabase.from("staff").select("user_id").eq("dive_center_id", diveCenterId).not("user_id", "is", null),
  ]);

  const linkedIds = new Set((linkedStaff ?? []).map((s) => s.user_id));
  const unlinkedSecretaries = (secretaries ?? [])
    .filter((s) => !linkedIds.has(s.id))
    .map((s) => ({ id: s.id, fullName: s.full_name, email: s.email }));

  return {
    roster: (staffRows ?? []).map(mapStaff),
    certifications: (certRows ?? []).map((c) => ({
      id: c.id,
      staffId: c.staff_id,
      certName: c.cert_name,
      expiryDate: c.expiry_date,
    })),
    unlinkedSecretaries,
  };
}
