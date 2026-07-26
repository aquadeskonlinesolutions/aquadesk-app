"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Profile", href: "/settings/profile" },
  { label: "Pricing & Rates", href: "/settings/pricing" },
  { label: "Staff Access", href: "/settings/staff-access" },
  { label: "Waiver & Registration", href: "/settings/waiver" },
  { label: "Equipment", href: "/settings/equipment" },
  { label: "Integrations", href: "/settings/integrations" },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-gray-200">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
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
