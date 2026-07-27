"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The live app's settings.html has these 12 tabs, in this exact order
// (tab buttons, lines 282-293) — a prior session had consolidated these
// into 6 rebuild tabs, but the user asked to split back to the real 12
// once they started using Settings day-to-day and found Fleet/Dive Sites
// had no click target of their own.
const TABS = [
  { label: "Profile", href: "/settings/profile" },
  { label: "Staff", href: "/settings/staff" },
  { label: "Fleet", href: "/settings/fleet" },
  { label: "Pricing & Rates", href: "/settings/pricing" },
  { label: "Courses", href: "/settings/courses" },
  { label: "Dive Sites", href: "/settings/dive-sites" },
  { label: "Equipment Rental", href: "/settings/equipment-rental" },
  { label: "Exchange Rates", href: "/settings/exchange-rates" },
  { label: "Waiver", href: "/settings/waiver" },
  { label: "Inventory", href: "/settings/inventory" },
  { label: "Passwords", href: "/settings/passwords" },
  { label: "Access & Permissions", href: "/settings/access" },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-gray-200">
      {TABS.map((tab) => {
        // Exact match or a genuine sub-path — plain startsWith would also
        // match "/settings/staff-access" against the "/settings/staff" tab
        // (a real bug: two tabs sharing a URL prefix), so this can't just
        // be a naive prefix check.
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
  );
}
