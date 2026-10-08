import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { logout } from "@/app/auth/actions";
import { Logo } from "@/components/logo";
import { requirePlatformAdmin } from "@/lib/platform";

export const metadata: Metadata = { title: "HQ — SkoolStore", robots: { index: false, follow: false } };

// Superadmin area. Anyone who isn't a superadmin gets "Page not found".
export default async function HqLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Logo light href="/hq" />
          <span className="rounded-full bg-accent-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">HQ</span>
          <Link
            href="/account/password"
            title="Change password"
            className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <KeyRound className="h-5 w-5" />
          </Link>
          <form action={logout}>
            <button title="Log out" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white">
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
