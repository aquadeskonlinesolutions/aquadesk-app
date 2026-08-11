"use client";

import { useMemo, useState, useTransition } from "react";
import {
  updateSubscriptionStatus,
  markPaid,
  sendOwnerResetLink,
  unlockOwnerLogin,
} from "@/lib/actions/office";
import { StartBillingForm } from "./StartBillingForm";

type Status = "trial" | "active" | "suspended" | "cancelled";

type Owner = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  locked_until: string | null;
  role: string;
};

type DiveCenter = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  subscription_status: Status;
  billing_due_date: string | null;
  billing_amount: number | null;
  last_payment_date: string | null;
  created_at: string;
  users: Owner[] | null;
};

const STATUS_STYLES: Record<Status, string> = {
  trial: "bg-teal-light text-teal-mid",
  active: "bg-green-light text-green",
  suspended: "bg-orange-light text-orange",
  cancelled: "bg-red-light text-red",
};

const STATUS_OPTIONS: Status[] = ["trial", "active", "suspended", "cancelled"];

// Grace period matches Service Agreement 3.3 (5 days from due date before
// an active account is considered overdue).
const GRACE_DAYS = 5;

function daysOverdue(dc: DiveCenter): number {
  if (!dc.billing_due_date || dc.subscription_status !== "active") return 0;
  const due = new Date(`${dc.billing_due_date}T00:00:00`);
  const graceEnd = new Date(due);
  graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - graceEnd.getTime()) / 86400000);
  return diffDays > 0 ? diffDays : 0;
}

function ownerOf(dc: DiveCenter): Owner | null {
  return (dc.users ?? []).find((u) => u.role === "owner") ?? null;
}

export function DiveCenterList({ diveCenters }: { diveCenters: DiveCenter[] }) {
  const [query, setQuery] = useState("");
  const [billingModalDc, setBillingModalDc] = useState<DiveCenter | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = diveCenters.length;
    const suspended = diveCenters.filter((d) => d.subscription_status === "suspended").length;
    const active = diveCenters.filter((d) => d.subscription_status === "active").length;
    const overdue = diveCenters.filter((d) => daysOverdue(d) > 0).length;
    const now = new Date();
    const thisMonth = diveCenters.filter((d) => {
      const created = new Date(d.created_at);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
    return { total, active, suspended, thisMonth, overdue };
  }, [diveCenters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return diveCenters;
    return diveCenters.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.email ?? "").toLowerCase().includes(q) ||
        (ownerOf(d)?.email ?? "").toLowerCase().includes(q),
    );
  }, [diveCenters, query]);

  if (diveCenters.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-card border border-gray-200 p-8 text-center text-gray-400 text-sm">
        No dive centers yet.
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-5 gap-3 mb-4">
        {[
          { label: "Total", value: stats.total },
          { label: "Active", value: stats.active },
          { label: "Suspended", value: stats.suspended },
          { label: "Created this month", value: stats.thisMonth },
          { label: "Overdue", value: stats.overdue },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-card shadow-card border border-gray-200 p-4">
            <div className="text-xs text-gray-400">{s.label}</div>
            <div className="font-display text-2xl text-navy">{s.value}</div>
          </div>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by dive center or owner email…"
        className="w-full mb-3 rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
      />

      {actionError && <p className="text-sm text-red mb-2">{actionError}</p>}

      <div className="bg-white rounded-card shadow-card border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Billing</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((dc) => {
              const owner = ownerOf(dc);
              const overdue = daysOverdue(dc);
              const isLocked = !!owner?.locked_until && new Date(owner.locked_until) > new Date();
              const dueLabel = dc.billing_due_date
                ? `Due ${new Date(`${dc.billing_due_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                : "Billing not started";

              return (
                <tr key={dc.id} className="border-t border-gray-200 align-top">
                  <td className="px-4 py-3 font-medium text-navy">{dc.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {dc.email ?? "—"}
                    {dc.phone ? ` · ${dc.phone}` : ""}
                    {dc.address ? <div className="text-xs text-gray-400 mt-0.5">{dc.address}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={dc.subscription_status}
                      disabled={pending}
                      onChange={(e) => {
                        setActionError(null);
                        startTransition(() => {
                          updateSubscriptionStatus(dc.id, e.target.value as Status);
                        });
                      }}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize border-0 ${STATUS_STYLES[dc.subscription_status]}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className={overdue > 0 ? "text-red text-xs font-medium" : "text-gray-500 text-xs"}>
                      {overdue > 0 ? `⚠ ${overdue} day${overdue > 1 ? "s" : ""} overdue` : dueLabel}
                    </div>
                    {dc.billing_amount ? (
                      <div className="text-xs text-gray-400 mt-0.5">₱{dc.billing_amount.toLocaleString("en-PH")}/mo</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {!dc.billing_due_date ? (
                        <button
                          onClick={() => setBillingModalDc(dc)}
                          className="text-teal-mid hover:underline text-xs font-medium"
                        >
                          Start Billing
                        </button>
                      ) : (
                        <button
                          disabled={pending}
                          onClick={() => {
                            setActionError(null);
                            startTransition(async () => {
                              const res = await markPaid(dc.id);
                              if (res.error) setActionError(res.error);
                            });
                          }}
                          className="text-teal-mid hover:underline text-xs font-medium"
                        >
                          Mark as Paid
                        </button>
                      )}
                      {owner?.email && (
                        <button
                          disabled={pending}
                          onClick={() => {
                            setActionError(null);
                            startTransition(async () => {
                              const res = await sendOwnerResetLink(owner.email);
                              if (res.error) setActionError(res.error);
                            });
                          }}
                          className="text-gray-500 hover:underline text-xs font-medium"
                        >
                          Reset Link
                        </button>
                      )}
                      {isLocked && owner?.email && (
                        <button
                          disabled={pending}
                          onClick={() => {
                            setActionError(null);
                            startTransition(async () => {
                              const res = await unlockOwnerLogin(owner.email);
                              if (res.error) setActionError(res.error);
                            });
                          }}
                          className="text-red hover:underline text-xs font-medium"
                        >
                          Unlock Login
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {billingModalDc && (
        <StartBillingForm
          diveCenterId={billingModalDc.id}
          diveCenterName={billingModalDc.name}
          onClose={() => setBillingModalDc(null)}
        />
      )}
    </div>
  );
}
