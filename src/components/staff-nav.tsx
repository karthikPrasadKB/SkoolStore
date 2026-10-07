"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Receipt, type LucideIcon } from "lucide-react";
import { areasFor, type Role } from "@/lib/roles";

const ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/kitchen": Package,
  "/counter": Receipt,
};

// Sidebar links on desktop, a scrollable strip on phones.
export function StaffNav({ role, layout }: { role: Role; layout: "sidebar" | "strip" }) {
  const pathname = usePathname();

  return (
    <nav className={layout === "sidebar" ? "space-y-1" : "flex gap-1 overflow-x-auto"}>
      {areasFor(role).map((area) => {
        const Icon = ICONS[area.href] ?? LayoutDashboard;
        const active = pathname.startsWith(area.href);
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
          </Link>
        );
      })}
    </nav>
  );
}
