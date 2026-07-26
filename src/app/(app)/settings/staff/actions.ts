"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { StaffPosition, EmploymentStatus } from "./data";

function ok() {
  revalidatePath("/settings/staff");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

export type StaffFormFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  position: StaffPosition;
  employmentStatus: EmploymentStatus | "";
  dateHired: string;
  dailyRate: string;
  nitroxCertified: boolean;
  linkedUserId: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  emergencyContactWhatsapp: string;
  emergencyContactEmail: string;
};

function toRow(user: { diveCenterId: string }, fields: StaffFormFields) {
  return {
    dive_center_id: user.diveCenterId,
    user_id: fields.linkedUserId || null,
    first_name: fields.firstName.trim(),
    last_name: fields.lastName.trim(),
    email: fields.email.trim() || null,
    phone: fields.phone.trim() || null,
    whatsapp: fields.whatsapp.trim() || null,
    position: fields.position,
    employment_status: fields.employmentStatus || null,
    date_hired: fields.dateHired || null,
    daily_rate: fields.dailyRate.trim() ? Number(fields.dailyRate) : null,
    nitrox_certified: fields.nitroxCertified,
    emergency_contact_name: fields.emergencyContactName.trim() || null,
    emergency_contact_phone: fields.emergencyContactPhone.trim() || null,
    emergency_contact_relationship: fields.emergencyContactRelationship.trim() || null,
    emergency_contact_whatsapp: fields.emergencyContactWhatsapp.trim() || null,
    emergency_contact_email: fields.emergencyContactEmail.trim() || null,
  };
}

export async function createStaffMember(fields: StaffFormFields) {
  const user = await requireOwner();
  if (!fields.firstName.trim() || !fields.lastName.trim()) {
    return fail("First and last name are required.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("staff").insert(toRow(user, fields));
  if (error) return fail(error.message);
  return ok();
}

export async function updateStaffMember(staffId: string, fields: StaffFormFields) {
  const user = await requireOwner();
  if (!fields.firstName.trim() || !fields.lastName.trim()) {
    return fail("First and last name are required.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update(toRow(user, fields))
    .eq("id", staffId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function toggleStaffActive(staffId: string, isActive: boolean) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ is_active: isActive })
    .eq("id", staffId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function deleteStaffMember(staffId: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .delete()
    .eq("id", staffId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function addCertification(staffId: string, certName: string, expiryDate: string) {
  const user = await requireOwner();
  if (!certName.trim()) return fail("Certification name is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("staff_certifications").insert({
    dive_center_id: user.diveCenterId,
    staff_id: staffId,
    cert_name: certName.trim(),
    expiry_date: expiryDate || null,
  });
  if (error) return fail(error.message);
  return ok();
}

export async function deleteCertification(certId: string) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_certifications")
    .delete()
    .eq("id", certId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}
