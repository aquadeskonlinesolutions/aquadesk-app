"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSubscriptionTabEnabled } from "@/lib/featureFlags";

// The live app's settings.html has these 12 tabs, in this exact order
// (tab buttons, lines 282-293) — a prior session had consolidated these
// into 6 rebuild tabs, but the user asked to split back to the real 12
// once they started using Settings day-to-day and found Fleet/Dive Sites
// had no click target of their own.
//
// A function, not a module-level constant, because the Subscription tab's
// visibility now also depends on paddle_billing_enabled — a per-dive-center
// value passed in as a prop, not just the build-time global flag.
function getTabs(paddleBillingEnabled: boolean) {
  return [
    {
      label: "Profile",
      href: "/settings/profile",
      description:
        "Your dive center's name, contact info, and logo — how you appear across the app and to divers registering online.",
    },
    // Hidden until the live Paddle account is verified (build-time global
    // kill switch, see featureFlags.ts) AND until this specific dive center
    // has been opted into Paddle billing (paddle_billing_enabled) — most
    // customers stay on manual bank-transfer billing to avoid Paddle's fees,
    // so both gates must pass.
    ...(isSubscriptionTabEnabled() && paddleBillingEnabled
      ? [
          {
            label: "Subscription",
            href: "/settings/subscription",
            description:
              "Your AquaDesk plan status and billing — choose Monthly or Annual and manage payment.",
          },
        ]
      : []),
    {
      label: "Staff",
      href: "/settings/staff",
      description:
        "Your team roster, emergency contacts, and certifications. Secretary logins are created separately under Access & Permissions.",
    },
    {
      label: "Fleet",
      href: "/settings/fleet",
      description:
        "Your boats — names, captains, and passenger capacity, used when building each day's schedule.",
    },
    {
      label: "Pricing & Rates",
      href: "/settings/pricing",
      description:
        "How diving is priced — package or tier mode, add-on charges, and staff commission rates.",
    },
    {
      label: "Courses & Bundles",
      href: "/settings/courses",
      description:
        "Course prices, whether gear is included, and multi-dive bundles divers can be charged as one flat fee.",
    },
    {
      label: "Dive Sites",
      href: "/settings/dive-sites",
      description:
        "Your dive sites and trip types, used when building schedules and estimating fuel, marine tax, and shark fee charges.",
    },
    {
      label: "Equipment Rental",
      href: "/settings/equipment-rental",
      description:
        "Rental rates for gear like BCDs, wetsuits, and computers — charged per dive or per day.",
    },
    {
      label: "Exchange Rates",
      href: "/settings/exchange-rates",
      description:
        "Foreign currency conversion rates and card/online surcharges, used when recording payments.",
    },
    {
      label: "Waiver",
      href: "/settings/waiver",
      description:
        "The waiver text and medical questions divers see and sign during online registration.",
    },
    {
      label: "Inventory",
      href: "/settings/inventory",
      description:
        "Tank counts, fuel levels, and rental gear stock — what you actually have on hand.",
    },
    {
      label: "Passwords",
      href: "/settings/passwords",
      description:
        "Change the owner and billing-unlock passwords that protect sensitive actions.",
    },
    {
      label: "Access & Permissions",
      href: "/settings/access",
      description:
        "Create secretary logins and control what each one can see, including revenue.",
    },
  ];
}

export function SettingsTabs({
  paddleBillingEnabled,
}: {
  paddleBillingEnabled: boolean;
}) {
  const pathname = usePathname();
  const TABS = getTabs(paddleBillingEnabled);
  const activeTab = TABS.find(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  );

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => {
          // Exact match or a genuine sub-path — plain startsWith would also
          // match "/settings/staff-access" against the "/settings/staff" tab
          // (a real bug: two tabs sharing a URL prefix), so this can't just
          // be a naive prefix check.
          const isActive = tab === activeTab;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-teal text-navy"
                  : "border-transparent text-gray-600 hover:text-navy"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {activeTab && (
        <p className="text-gray-600 text-sm mt-3">{activeTab.description}</p>
      )}
    </div>
  );
}
