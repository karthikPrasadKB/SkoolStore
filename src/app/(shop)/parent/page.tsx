import { Baby, CalendarClock, IdCard, UtensilsCrossed } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Children, type Child } from "./children";

const STEPS = [
  { icon: Baby, title: "Add your children", text: "Link each child to your account once." },
  { icon: CalendarClock, title: "Order or pre-order", text: "Order for today, or plan the whole week ahead." },
  { icon: IdCard, title: "Pick up with ID card", text: "Your child shows their ID card at the counter." },
];

export default async function ParentPage() {
  const profile = await requireRole(["parent"]);
  const firstName = profile.full_name.split(" ")[0] || "there";
  const supabase = await createClient();
  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, class_name, code")
    .eq("parent_id", profile.id)
    .order("created_at");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-500 via-accent-400 to-amber-300 px-6 py-10 text-white sm:px-10 sm:py-14">
        <div className="relative z-10 max-w-lg">
          <p className="font-semibold text-accent-50">Hi {firstName} 👋</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            What&apos;s for lunch at {profile.school.name}?
          </h1>
          <p className="mt-3 text-accent-50">
            Fresh food from your school canteen, ready when your child is.
          </p>
        </div>
        <UtensilsCrossed className="absolute -right-6 -bottom-8 h-56 w-56 rotate-12 text-white/15" />
      </section>

      <Children students={(students ?? []) as Child[]} />

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-900">Today&apos;s menu</h2>
        <div className="mt-4 rounded-3xl border-2 border-dashed border-slate-200 px-6 py-14 text-center">
          <p className="text-4xl">🍱</p>
          <p className="mt-3 font-semibold text-slate-900">The menu is being set up</p>
          <p className="mt-1 text-sm text-slate-500">
            Your canteen&apos;s items will appear here soon, ready to add to your cart.
          </p>
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl bg-slate-50 p-5">
            <div className="inline-flex rounded-xl bg-accent-100 p-2.5 text-accent-600">
              <Icon className="h-5 w-5" />
            </div>
            <p className="mt-3 font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-sm text-slate-500">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
