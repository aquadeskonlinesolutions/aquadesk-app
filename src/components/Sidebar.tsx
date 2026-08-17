"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import type { CurrentUser } from "@/lib/dal";

// Matches the live app's dashboard.html sidebar: an icon-only 64px rail
// that expands to full width on hover (desktop). Unlike the live app —
// which has zero mobile affordance on some pages (scheduling.html's
// sidebar just vanishes below 760px) and a real UX bug on the pages that
// do collapse (tapping the collapsed rail on mobile swallows the first
// tap via preventDefault, requiring a second tap to actually navigate) —
// this uses one unified, explicit hamburger toggle for all pages and all
// screen sizes instead of relying on tap-the-collapsed-strip.
export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const expanded = hovered || pinnedOpen;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && user.role !== "owner") return false;
    if (item.requiresRevenue && user.role !== "owner" && !user.canViewRevenue)
      return false;
    if (item.requiresBoatManifest && !user.boatManifestEnabled) return false;
    return true;
  });

  return (
    <>
      {/* Reserves layout space for the always-present collapsed rail —
          the real sidebar is fixed-positioned so it can overlay content
          when expanded, matching the live app's overlay-not-push behavior. */}
      <div className="w-16 shrink-0" />

      {pinnedOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setPinnedOpen(false)}
        />
      )}

      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-navy text-white overflow-hidden transition-[width] duration-200 ${
          expanded ? "w-64" : "w-16"
        }`}
      >
        <div className="h-16 flex items-center gap-2 px-4 border-b border-white/10 shrink-0">
          <button
            onClick={() => setPinnedOpen((v) => !v)}
            aria-label="Toggle menu"
            className="w-9 h-9 shrink-0 rounded-[9px] overflow-hidden"
          >
            <img src="/logo.png" alt="AquaDesk" className="w-full h-full object-contain" />
          </button>
          <span
            className={`font-display text-xl tracking-tight whitespace-nowrap transition-opacity duration-150 ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          >
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
                onClick={() => setPinnedOpen(false)}
                className={`flex items-center gap-3 px-[18px] py-3 text-sm font-medium border-l-4 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-teal bg-white/5 text-white"
                    : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="text-base shrink-0" aria-hidden>
                  {item.icon}
                </span>
                <span
                  className={`transition-opacity duration-150 ${expanded ? "opacity-100" : "opacity-0"}`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div
          className={`px-4 py-4 border-t border-white/10 text-sm whitespace-nowrap transition-opacity duration-150 ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="font-medium">{user.fullName}</div>
          <div className="text-white/60 capitalize">{user.role}</div>
        </div>
      </aside>
    </>
  );
}
