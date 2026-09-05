import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { BASE_PAYMENT_CHANNELS, type PaymentChannel } from "./payments";

export type ResolvedChannel = { channel: PaymentChannel; customChannelId: string | null };

export type CustomChannelOption = { id: string; label: string };

// This dive center's own previously-added custom channels — populates
// the "+ Add Channel" dropdown's reusable options going forward. Scoped
// per dive center by RLS, called from every place that renders a channel
// dropdown (Bill Summary, Deposits, Expenses, and the shared
// SettlePaymentDialog behind Join Ride/Rental Gear/Staff Commission).
export async function loadCustomChannels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
): Promise<CustomChannelOption[]> {
  const { data } = await supabase
    .from("payment_channels")
    .select("id, label")
    .eq("dive_center_id", diveCenterId)
    .order("label", { ascending: true });
  return data ?? [];
}

// Shared by every one of the 6 places that record an online channel
// (bill payment, deposits, expenses, join ride settlement, rental gear
// settlement, staff commission payout) — identical dedup-match-or-create
// logic everywhere, same shape as saveExpenseRecord's category resolution
// in reports/actions.ts. Exactly one of channelId/newChannelLabel should
// be set by the caller: channelId reuses an existing per-dive-center
// channel picked straight from the dropdown; newChannelLabel is what was
// typed via "+ Add Channel" and still needs resolving.
export async function resolveOnlineChannel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  args: { channelId: string | null; newChannelLabel: string | null },
): Promise<{ error: string } | ResolvedChannel> {
  if (args.channelId) {
    return { channel: "custom", customChannelId: args.channelId };
  }

  const typed = (args.newChannelLabel ?? "").trim();
  if (!typed) return { error: "Enter a channel name." };
  const normalized = typed.toLowerCase();

  // Case-insensitive/trimmed match against the 4 real base channels first
  // — reuse the base channel instead of creating a near-duplicate custom
  // one (e.g. typing "wise" reuses the existing Wise channel).
  const baseMatch = BASE_PAYMENT_CHANNELS.find(([, label]) => label.trim().toLowerCase() === normalized);
  if (baseMatch) {
    return { channel: baseMatch[0], customChannelId: null };
  }

  const { data: existing } = await supabase
    .from("payment_channels")
    .select("id")
    .eq("dive_center_id", diveCenterId)
    .eq("normalized_label", normalized)
    .maybeSingle();
  if (existing) {
    return { channel: "custom", customChannelId: existing.id };
  }

  const { data: created, error: createError } = await supabase
    .from("payment_channels")
    .insert({ dive_center_id: diveCenterId, label: typed, normalized_label: normalized })
    .select("id")
    .single();
  if (createError) {
    // Two secretaries typing the same new channel at the same moment can
    // both miss the check above — the unique constraint on
    // (dive_center_id, normalized_label) catches it; fall back to
    // whichever row actually won instead of surfacing the raw conflict.
    if (createError.code === "23505") {
      const { data: raceWinner } = await supabase
        .from("payment_channels")
        .select("id")
        .eq("dive_center_id", diveCenterId)
        .eq("normalized_label", normalized)
        .maybeSingle();
      if (raceWinner) return { channel: "custom", customChannelId: raceWinner.id };
    }
    return { error: createError.message };
  }
  return { channel: "custom", customChannelId: created.id };
}
