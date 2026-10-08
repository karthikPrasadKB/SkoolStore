import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { addDays, formatDay, todayInIndia } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { PreorderList, type PreorderRow } from "./preorder-list";

export default async function PreordersPage({ searchParams }: PageProps<"/counter/preorders">) {
  await requireRole(["admin", "canteen_staff", "counter_staff"]);
  const { date } = await searchParams;
  const today = todayInIndia();
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, student:students(full_name, class_name, id_card_number), slot:break_slots(id, name, starts_at), items:order_items(name, quantity, options)",
    )
    .eq("source", "preorder")
    .eq("pickup_date", day)
    .in("status", ["paid", "packed", "collected"]);
  const orders = (data ?? []) as unknown as PreorderRow[];

  const dayLink = (d: string, label: string) => (
    <Link
      href={d === today ? "/counter/preorders" : `/counter/preorders?date=${d}`}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
        d === day ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Pre-orders" description={`For ${day === today ? "today" : formatDay(day)}, A–Z by first name`} />
        <div className="flex gap-2">
          {dayLink(today, "Today")}
          {dayLink(addDays(today, 1), "Tomorrow")}
        </div>
      </div>
      {/* key: start fresh when the day changes */}
      <PreorderList key={day} orders={orders} />
    </>
  );
}
