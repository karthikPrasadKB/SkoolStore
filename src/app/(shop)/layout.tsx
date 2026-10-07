import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Search, ShoppingCart } from "lucide-react";
import { logout } from "@/app/auth/actions";
import { Logo } from "@/components/logo";
import { getProfile } from "@/lib/auth";

// Frame for parent screens: a shopping-site style header.
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:gap-6">
          <Logo href="/parent" />
          <div className="relative hidden flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search sandwiches, juices, snacks…"
              className="w-full rounded-full border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-accent-400 focus:bg-white focus:ring-4 focus:ring-accent-400/15"
            />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <Link
              href="/parent"
              className="relative rounded-full p-2.5 text-slate-700 hover:bg-slate-100"
              title="Cart"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
                0
              </span>
            </Link>
            <div className="hidden text-right text-sm leading-tight md:block">
              <p className="font-semibold text-slate-900">{profile.full_name}</p>
              <p className="text-xs text-slate-500">{profile.school.name}</p>
            </div>
            <form action={logout}>
              <button title="Log out" className="rounded-full p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
