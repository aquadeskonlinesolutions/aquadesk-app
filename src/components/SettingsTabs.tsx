"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Order matches the live app's settings.html: Profile, then Staff (its
// own real tab there — confirmed via tab-staff right after tab-profile in
// the source), then the rest.
const TABS = [
  { label: "Profile", href: "/settings/profile" },
  { label: "Staff", href: "/settings/staff" },
  { label: "Pricing & Rates", href: "/settings/pricing" },
  { label: "Staff Access", href: "/settings/staff-access" },
  { label: "Waiver & Registration", href: "/settings/waiver" },
  { label: "Equipment", href: "/settings/equipment" },
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
