import "server-only";
import { Resend } from "resend";

export function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "AquaDesk <onboarding@resend.dev>";
