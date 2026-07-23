"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import type { CurrentUser } from "@/lib/dal";

export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && user.role !== "owner") return false;
    if (item.requiresRevenue && user.role !== "owner" && !user.canViewRevenue)
      return false;
    return true;
  });

  return (
    <aside className="w-[260px] shrink-0 bg-navy text-white flex flex-col">
      <div className="h-16 flex items-center gap-2 px-6 border-b border-white/10">
        <div className="w-9 h-9 rounded-[9px] bg-teal flex items-center justify-center font-display text-lg">
          A
        </div>
        <span className="font-display text-xl tracking-tight">
          Aqua<span className="text-teal">Desk</span>
        </span>
      </div>

      <nav className="flex-1 py-4">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-6 py-3 text-sm font-medium border-l-4 transition-colors ${
                isActive
                  ? "border-teal bg-white/5 text-white"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-white/10 text-sm">
        <div className="font-medium">{user.fullName}</div>
        <div className="text-white/60 capitalize">{user.role}</div>
      </div>
    </aside>
  );
}
