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
  crewTokenToday: string | null;
};

function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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

// RLS already restricts which staff rows come back (owner sees every row
// in the dive center, a secretary only sees their own linked row) — this
// query doesn't need to branch on role itself, only the unlinked-secretary
// picker below is owner-only functionality.
export async function loadStaffPageData(
  diveCenterId: string,
  isOwner: boolean,
): Promise<StaffPageData> {
  const supabase = await createClient();

  const [{ data: staffRows }, { data: certRows }, { data: dc }] = await Promise.all([
    supabase
      .from("staff")
      .select("*")
      .eq("dive_center_id", diveCenterId)
      .order("first_name"),
    supabase
      .from("staff_certifications")
      .select("id, staff_id, cert_name, expiry_date")
      .eq("dive_center_id", diveCenterId)
      .order("expiry_date"),
    supabase
      .from("dive_centers")
      .select("staff_token, staff_token_date")
      .eq("id", diveCenterId)
      .single(),
  ]);

  let unlinkedSecretaries: UnlinkedSecretary[] = [];
  if (isOwner) {
    const [{ data: secretaries }, { data: linkedStaff }] = await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, email")
        .eq("dive_center_id", diveCenterId)
        .eq("role", "secretary"),
      supabase
        .from("staff")
        .select("user_id")
        .eq("dive_center_id", diveCenterId)
        .not("user_id", "is", null),
    ]);
    const linkedIds = new Set((linkedStaff ?? []).map((s) => s.user_id));
    unlinkedSecretaries = (secretaries ?? [])
      .filter((s) => !linkedIds.has(s.id))
      .map((s) => ({ id: s.id, fullName: s.full_name, email: s.email }));
  }

  const crewTokenToday =
    dc?.staff_token && dc?.staff_token_date === todayManila() ? dc.staff_token : null;

  return {
    roster: (staffRows ?? []).map(mapStaff),
    certifications: (certRows ?? []).map((c) => ({
      id: c.id,
      staffId: c.staff_id,
      certName: c.cert_name,
      expiryDate: c.expiry_date,
    })),
    unlinkedSecretaries,
    crewTokenToday,
  };
}
