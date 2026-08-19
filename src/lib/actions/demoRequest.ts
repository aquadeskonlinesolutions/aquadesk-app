"use server";

import { getResendClient, RESEND_FROM_EMAIL } from "@/lib/email/resend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_REQUEST_RECIPIENT = "aquadeskonline@gmail.com";

export type DemoRequestInput = {
  name: string;
  email: string;
  whatsapp: string;
  // Honeypot — real users never see or fill this field. A non-empty value
  // means a bot filled it, so we report success without sending anything.
  honeypot: string;
};

export type DemoRequestState = { error?: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function requestDemo(input: DemoRequestInput): Promise<DemoRequestState> {
  if (input.honeypot.trim()) {
    return {};
  }

  const name = input.name.trim();
  const email = input.email.trim();
  const whatsapp = input.whatsapp.trim();

  if (!name || !email || !whatsapp) {
    return { error: "Please fill in all fields." };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const resend = getResendClient();
  const { error: sendError } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: DEMO_REQUEST_RECIPIENT,
    replyTo: email,
    subject: `New demo request — ${name}`,
    html: `
      <p>New demo request submitted from the AquaDesk landing page.</p>
      <p>
        <strong>Name:</strong> ${escapeHtml(name)}<br>
        <strong>Email:</strong> ${escapeHtml(email)}<br>
        <strong>WhatsApp:</strong> ${escapeHtml(whatsapp)}
      </p>
    `,
  });

  if (sendError) {
    return { error: `Could not send your request: ${sendError.message}` };
  }

  return {};
}
