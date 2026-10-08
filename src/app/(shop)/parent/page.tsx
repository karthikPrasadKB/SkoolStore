import { Baby, CalendarClock, IdCard, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDay, todayInIndia } from "@/lib/dates";
import { formatINR } from "@/lib/menu";
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
    { data: upcomingRows },
    { data: requestRows },
  ] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, full_name, class_name, code, id_card_number, school_id, wallet_allowed, wallet_daily_limit, school:schools(name, join_code, use_canteen_codes)",
      )
      .eq("parent_id", profile.id)
      .order("created_at"),
    supabase.from("wallets").select("school_id, balance").eq("parent_id", profile.id),
    supabase
      .from("wallet_transactions")
      .select(
        "id, type, amount, balance_after, payment_method, note, created_at, wallet:wallets!inner(parent_id, school:schools(name)), student:students(full_name)",
      )
      .eq("wallet.parent_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("parent_schools").select("school:schools(id, name, join_code)").eq("parent_id", profile.id),
    supabase.rpc("list_schools"),
    supabase
      .from("orders")
      .select("id, pickup_date, total, student:students(full_name)")
      .eq("source", "preorder")
      .in("status", ["placed", "paid", "packed"])
      .gte("pickup_date", todayInIndia())
      .order("pickup_date")
      .limit(5),
    supabase
      .from("support_requests")
      .select("id, message, id_card_number, status, admin_reply, created_at, school:schools(name)")
      .eq("parent_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // list_schools only returns schools that are active (not paused from HQ); anything else is hidden here.
  const allSchools = (allSchoolRows ?? []) as School[];
  const activeIds = new Set(allSchools.map((s) => s.id));
  // The schools this parent is linked to, with their main school first.
  const linkedSchools = ((linkRows ?? []) as unknown as { school: School | null }[])
    .map((row) => row.school)
    .filter((school): school is School => Boolean(school) && activeIds.has(school!.id))
    .sort((a, b) => (a.id === profile.school_id ? -1 : b.id === profile.school_id ? 1 : a.name.localeCompare(b.name)));

  const students = ((studentRows ?? []) as unknown as (Child & { school_id: string })[])
    .filter((child) => activeIds.has(child.school_id))
    .map((child) => ({
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
  ]
    .filter((schoolId) => activeIds.has(schoolId))
    .map((schoolId) => ({
      school_id: schoolId,
      school_name: schoolNames.get(schoolId) ?? "School",
      balance: balanceBySchool.get(schoolId) ?? 0,
    }));

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

  const today = todayInIndia();
  const upcoming = (upcomingRows ?? []) as unknown as {
    id: string;
    pickup_date: string;
    total: number;
    student: { full_name: string } | null;
  }[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-500 via-accent-400 to-amber-300 px-6 py-10 text-white sm:px-10 sm:py-14">
        <div className="relative z-10 max-w-lg">
          <p className="font-semibold text-accent-50">Hi {firstName} 👋</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            What&apos;s for lunch at {profile.school.name}?
          </h1>
          <p className="mt-3 text-accent-50">Fresh food from your school canteen, ready when your child is.</p>
          {students.length > 0 && (
            <Link
              href="/parent/order"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-accent-600 shadow-sm hover:bg-accent-50"
            >
              <UtensilsCrossed className="h-5 w-5" /> Order food
            </Link>
          )}
        </div>
        <UtensilsCrossed className="absolute -right-6 -bottom-8 h-56 w-56 rotate-12 text-white/15" />
      </section>

      {upcoming.length > 0 && (
        <section className="mt-8 rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Coming up</h2>
            <Link href="/parent/orders" className="text-sm font-semibold text-accent-600 hover:underline">
              All orders →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {upcoming.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-semibold text-slate-900">
                    {order.pickup_date === today ? "Today" : formatDay(order.pickup_date)}
                  </span>
                  <span className="text-slate-500"> · {order.student?.full_name.split(" ")[0]}</span>
                </span>
                <span className="font-semibold">{formatINR(Number(order.total))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {students.length === 0 && (
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
      )}
    </div>
  );
}
