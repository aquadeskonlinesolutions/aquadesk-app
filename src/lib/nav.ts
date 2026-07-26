export type NavItem = {
  label: string;
  href: string;
  icon: string;
  // Every dive-center-app route is visible to both tiers by default;
  // list explicit exceptions here per the Stage 1a RLS pattern.
  ownerOnly?: boolean;
  requiresRevenue?: boolean;
};

// Order and destinations match the live app's own sidebar exactly —
// "Divers" (the group/individual/equipment triage tool) and "Diver Form"
// (the profile/billing workspace) are two separate nav items there, not
// one. Staff is deliberately absent — it lives under Settings in the live
// app, and crew-code generation lives on Scheduling, not a standalone
// Staff page (confirmed by reading staff.html/scheduling.html directly).
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "Divers", href: "/divers", icon: "🤿" },
  { label: "Diver Form", href: "/diver-form", icon: "📋" },
  { label: "Scheduling", href: "/scheduling", icon: "📅" },
  { label: "Boat Manifest", href: "/boat-manifest", icon: "🚤" },
  { label: "Reports", href: "/reports", icon: "📊", requiresRevenue: true },
  { label: "Settings", href: "/settings", icon: "⚙️", ownerOnly: true },
];
