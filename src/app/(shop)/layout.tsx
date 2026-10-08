import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { logout } from "@/app/auth/actions";
import { Logo } from "@/components/logo";
import { ShopNav } from "@/components/shop-nav";
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
          <div className="flex-1 overflow-x-auto">
            <ShopNav />
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden text-right text-sm leading-tight md:block">
              <p className="font-semibold text-slate-900">{profile.full_name}</p>
              {!profile.school_disabled && <p className="text-xs text-slate-500">{profile.school.name}</p>}
            </div>
            <Link
              href="/account/password"
              title="Change password"
              className="rounded-full p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <KeyRound className="h-5 w-5" />
            </Link>
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
