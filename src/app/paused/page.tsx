import { redirect } from "next/navigation";
import { CirclePause } from "lucide-react";
import { logout } from "@/app/auth/actions";
import { Logo } from "@/components/logo";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SwitchButton } from "./switch-button";

// Shown to staff whose school belongs to a client that has been disabled from HQ.
export default async function PausedPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "parent" || !profile.school_disabled) redirect("/");

  // Other schools they work at that are still active.
  const supabase = await createClient();
  const { data } = await supabase
    .from("school_memberships")
    .select("school:schools(id, name)")
    .eq("profile_id", profile.id);
  const schools = ((data ?? []) as unknown as { school: { id: string; name: string } | null }[])
    .map((m) => m.school)
    .filter((s): s is { id: string; name: string } => Boolean(s) && s!.id !== profile.school_id);
  const active: { id: string; name: string }[] = [];
  for (const school of schools) {
    const { data: paused } = await supabase.rpc("access_paused_at", { p_school_id: school.id });
    if (!paused) active.push(school);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-4 py-16 text-center">
      <Logo />
      <CirclePause className="mt-10 h-14 w-14 text-amber-500" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Access paused</h1>
      <p className="mt-2 max-w-md text-slate-600">
        {profile.school.name}&apos;s access to SkoolStore has been paused. Please contact SkoolStore if you think this is
        a mistake.
      </p>

      {active.length > 0 && (
        <div className="mt-8 w-full max-w-sm">
          <p className="mb-2 text-sm font-semibold text-slate-700">You also work at:</p>
          <div className="space-y-2">
            {active.map((school) => (
              <SwitchButton key={school.id} schoolId={school.id} name={school.name} />
            ))}
          </div>
        </div>
      )}

      <form action={logout} className="mt-8">
        <button className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">
          Log out
        </button>
      </form>
    </main>
  );
}
