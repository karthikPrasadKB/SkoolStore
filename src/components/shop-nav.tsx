"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ReceiptText, UtensilsCrossed } from "lucide-react";

const LINKS = [
  { href: "/parent", label: "Home", icon: House },
  { href: "/parent/order", label: "Order food", icon: UtensilsCrossed },
  { href: "/parent/orders", label: "My orders", icon: ReceiptText },
];

// Parent navigation: tabs in the header.
export function ShopNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition ${
              active ? "bg-accent-50 text-accent-600" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className={active ? "" : "hidden sm:inline"}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
