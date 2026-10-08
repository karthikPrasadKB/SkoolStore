import { redirect } from "next/navigation";
import { CirclePause } from "lucide-react";
import { logout } from "@/app/auth/actions";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FirstSchoolForm } from "./first-school-form";

// First login for a client's admin: they create their first school here.
export default async function WelcomePage() {
  if (await getProfile()) redirect("/");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_pending_client");
  const pending = data as { full_name: string; disabled: boolean } | null;
  if (!pending) redirect("/");

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-4 py-16">
      <Logo />
      <Card className="mt-8 w-full max-w-md p-8">
        {pending.disabled ? (
          <div className="text-center">
            <CirclePause className="mx-auto h-12 w-12 text-amber-500" />
            <h1 className="mt-3 text-xl font-bold text-slate-900">Access paused</h1>
            <p className="mt-2 text-slate-600">Your access to SkoolStore has been paused. Please contact SkoolStore.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900">Welcome, {pending.full_name.split(" ")[0]}!</h1>
            <p className="mt-2 text-slate-600">
              Let&apos;s get your store set up. Start by creating your first school. You can add more schools, staff,
              menus and partners afterwards.
            </p>
            <div className="mt-6">
              <FirstSchoolForm />
            </div>
          </>
        )}
      </Card>
      <form action={logout} className="mt-6">
        <button className="text-sm font-semibold text-slate-500 hover:text-slate-800">Log out</button>
      </form>
    </main>
  );
}
