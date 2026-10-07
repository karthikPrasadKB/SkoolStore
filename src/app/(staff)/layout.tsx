import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/app/auth/actions";
import { Logo } from "@/components/logo";
import { StaffNav } from "@/components/staff-nav";
import { getProfile } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

// Frame for admin and canteen staff screens: clean sidebar layout.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const initials = profile.full_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const userCard = (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {initials || "?"}
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold text-slate-900">{profile.full_name}</p>
        <p className="truncate text-slate-500">{ROLE_LABELS[profile.role]}</p>
      </div>
    </div>
  );

  const logoutButton = (
    <form action={logout}>
      <button
        title="Log out"
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <LogOut className="h-[18px] w-[18px]" />
      </button>
    </form>
  );

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="px-2 py-1">
          <Logo />
        </div>
        <div className="mt-6 rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">School</p>
          <p className="truncate font-semibold text-slate-800">{profile.school.name}</p>
        </div>
        <div className="mt-6 flex-1">
          <StaffNav role={profile.role} layout="sidebar" />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
          {userCard}
          {logoutButton}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <Logo />
            {logoutButton}
          </div>
          <div className="mt-3">
            <StaffNav role={profile.role} layout="strip" />
          </div>
        </header>
        {/* Pages marked data-fullbleed (like the counter) use the whole width with no padding. */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-10 has-[[data-fullbleed]]:max-w-none has-[[data-fullbleed]]:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
