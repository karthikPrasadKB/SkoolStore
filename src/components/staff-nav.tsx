"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, History, LayoutDashboard, MessageSquare, Package, Receipt, Settings, type LucideIcon } from "lucide-react";
import { areasFor, type Role } from "@/lib/roles";

const ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/kitchen": Package,
  "/counter": Receipt,
  "/counter/sales": History,
  "/admin/students": GraduationCap,
  "/admin/requests": MessageSquare,
  "/admin/settings": Settings,
};

// Sidebar links on desktop, a scrollable strip on phones.
export function StaffNav({
  role,
  layout,
  badges = {},
}: {
  role: Role;
  layout: "sidebar" | "strip";
  // Small counts shown next to links, e.g. open requests.
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const areas = areasFor(role);
  // Highlight the most specific matching link, so /admin/settings doesn't also light up /admin.
  const activeHref = areas
    .filter((area) => pathname === area.href || pathname.startsWith(`${area.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className={layout === "sidebar" ? "space-y-1" : "flex gap-1 overflow-x-auto"}>
      {areas.map((area) => {
        const Icon = ICONS[area.href] ?? LayoutDashboard;
        const active = area.href === activeHref;
        return (
          <Link
            key={area.href}
            href={area.href}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
            {area.label}
            {(badges[area.href] ?? 0) > 0 && (
              <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                {badges[area.href]}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
