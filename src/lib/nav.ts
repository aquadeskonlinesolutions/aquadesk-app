export type NavItem = {
  label: string;
  href: string;
  // Every dive-center-app route is visible to both tiers by default;
  // list explicit exceptions here per the Stage 1a RLS pattern.
  ownerOnly?: boolean;
  requiresRevenue?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Scheduling", href: "/scheduling" },
  { label: "Divers", href: "/divers" },
  { label: "Boat Manifest", href: "/boat-manifest" },
  { label: "Staff", href: "/staff" },
  { label: "Reports", href: "/reports", requiresRevenue: true },
  { label: "Settings", href: "/settings", ownerOnly: true },
];
