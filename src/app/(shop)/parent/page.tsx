import { Baby, CalendarClock, IdCard, UtensilsCrossed } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { School } from "@/components/school-picker";
import { Children, type Child } from "./children";
import { ParentRequests, type ParentRequest } from "./requests";
import { WalletSection, type WalletBalance, type WalletTxn } from "./wallet";

const STEPS = [
  { icon: Baby, title: "Add your children", text: "Link each child to your account once." },
  { icon: CalendarClock, title: "Order or pre-order", text: "Order for today, or plan the whole week ahead." },
  { icon: IdCard, title: "Pick up with ID card", text: "Your child shows their ID card at the counter." },
];

export default async function ParentPage() {
  const profile = await requireRole(["parent"]);
  const firstName = profile.full_name.split(" ")[0] || "there";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const email = typeof auth?.claims.email === "string" ? auth.claims.email : "";
  const [
    { data: studentRows },
    { data: walletRows },
    { data: txnRows },
    { data: linkRows },
    { data: allSchoolRows },
    { data: requestRows },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, class_name, code, id_card_number, school_id, wallet_allowed, wallet_daily_limit, school:schools(name, use_canteen_codes)")
      .eq("parent_id", profile.id)
      .order("created_at"),
    supabase.from("wallets").select("school_id, balance").eq("parent_id", profile.id),
    supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, payment_method, note, created_at, wallet:wallets!inner(parent_id, school:schools(name)), student:students(full_name)")
      .eq("wallet.parent_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("parent_schools").select("school:schools(id, name, join_code)").eq("parent_id", profile.id),
    supabase.rpc("list_schools"),
    supabase
      .from("support_requests")
      .select("id, message, id_card_number, status, admin_reply, created_at, school:schools(name)")
      .eq("parent_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const allSchools = (allSchoolRows ?? []) as School[];
  // The schools this parent is linked to, with their main school first.
  const linkedSchools = ((linkRows ?? []) as unknown as { school: School | null }[])
    .map((row) => row.school)
    .filter((school): school is School => Boolean(school))
    .sort((a, b) => (a.id === profile.school_id ? -1 : b.id === profile.school_id ? 1 : a.name.localeCompare(b.name)));

  const students = ((studentRows ?? []) as unknown as (Child & { school_id: string })[]).map((child) => ({
    ...child,
    wallet_daily_limit: child.wallet_daily_limit === null ? null : Number(child.wallet_daily_limit),
  }));

  // One balance card per school the family uses (from their children and any existing wallets).
  const schoolNames = new Map<string, string>([[profile.school_id, profile.school.name]]);
  linkedSchools.forEach((school) => schoolNames.set(school.id, school.name));
  students.forEach((child) => schoolNames.set(child.school_id, child.school?.name ?? profile.school.name));
  const balanceBySchool = new Map(
    ((walletRows ?? []) as { school_id: string; balance: number }[]).map((w) => [w.school_id, Number(w.balance)]),
  );
  const balances: WalletBalance[] = [
    ...new Set([...linkedSchools.map((s) => s.id), ...students.map((c) => c.school_id), ...balanceBySchool.keys()]),
  ].map(
    (schoolId) => ({
      school_id: schoolId,
      school_name: schoolNames.get(schoolId) ?? "School",
      balance: balanceBySchool.get(schoolId) ?? 0,
    }),
  );

  type TxnRow = Omit<WalletTxn, "school_name" | "student_name"> & {
    wallet: { school: { name: string } | null };
    student: { full_name: string } | null;
  };
  const transactions: WalletTxn[] = ((txnRows ?? []) as unknown as TxnRow[]).map((t) => ({
    ...t,
    amount: Number(t.amount),
    balance_after: Number(t.balance_after),
    school_name: t.wallet.school?.name ?? "",
    student_name: t.student?.full_name ?? null,
  }));

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

      <Children
        students={students}
        homeSchool={profile.school.name}
        linkedSchools={linkedSchools}
        allSchools={allSchools}
        phone={profile.phone ?? ""}
        email={email}
      />

      <ParentRequests requests={(requestRows ?? []) as unknown as ParentRequest[]} />

      {students.length > 0 && <WalletSection balances={balances} transactions={transactions} />}

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
