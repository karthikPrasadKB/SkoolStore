import Link from "next/link";
import { CircleCheck, Download, Plus, Store } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { formatDay, nowInIndia, orderDeadline, todayInIndia, type CutoffRules } from "@/lib/dates";
import { formatINR } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import { CancelOrderButton } from "./cancel-order";

type OrderRow = {
  id: string;
  bill_number: number;
  source: "counter" | "preorder";
  status: string;
  pickup_date: string;
  total: number;
  payment_method: string | null;
  public_token: string;
  created_at: string;
  student: { full_name: string; class_name: string } | null;
  school: (CutoffRules & { name: string }) | null;
  order_items: { name: string; quantity: number; options: { name: string }[] }[];
};

const STATUS: Record<string, { label: string; tone: string }> = {
  placed: { label: "Awaiting payment", tone: "bg-amber-50 text-amber-700" },
  paid: { label: "Confirmed", tone: "bg-sky-50 text-sky-700" },
  packed: { label: "Ready for pickup", tone: "bg-violet-50 text-violet-700" },
  collected: { label: "Collected", tone: "bg-emerald-50 text-emerald-700" },
  not_collected: { label: "Not collected", tone: "bg-red-50 text-red-700" },
  cancelled: { label: "Cancelled", tone: "bg-slate-100 text-slate-500" },
};

export default async function ParentOrdersPage({ searchParams }: PageProps<"/parent/orders">) {
  await requireRole(["parent"]);
  const { placed } = await searchParams;
  const supabase = await createClient();

  // Parents see their children's orders (pre-orders and counter purchases) through their access rules.
  const { data } = await supabase
    .from("orders")
    .select(
      "id, bill_number, source, status, pickup_date, total, payment_method, public_token, created_at, student:students(full_name, class_name), school:schools(name, preorder_cutoff_time, preorder_cutoff_same_day, saturday_open), order_items(name, quantity, options)",
    )
    .order("pickup_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  const orders = (data ?? []) as unknown as OrderRow[];

  const today = todayInIndia();
  const now = nowInIndia();
  const upcoming = orders
    .filter((o) => o.pickup_date >= today && ["placed", "paid", "packed"].includes(o.status))
    .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date));
  const past = orders.filter((o) => !upcoming.includes(o));

  const card = (order: OrderRow) => {
    const status = STATUS[order.status] ?? { label: order.status, tone: "bg-slate-100 text-slate-600" };
    const canCancel =
      order.source === "preorder" &&
      ["placed", "paid"].includes(order.status) &&
      order.school !== null &&
      now < orderDeadline(order.school, order.pickup_date);
    return (
      <li key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-bold text-slate-900">
              {order.pickup_date === today ? "Today" : formatDay(order.pickup_date)}
              <span className="font-normal text-slate-500">
                {" · "}
                {order.student?.full_name ?? "—"}
                {order.student?.class_name && ` (${order.student.class_name})`}
              </span>
            </p>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              {order.source === "counter" ? (
                <>
                  <Store className="h-3.5 w-3.5" /> Bought at the counter
                </>
              ) : (
                "Pre-order"
              )}
              {" · "}Bill #{order.bill_number}
              {order.school && ` · ${order.school.name}`}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          {order.order_items
            .map((i) => `${i.quantity}× ${i.name}${i.options.length ? ` (${i.options.map((o) => o.name).join(", ")})` : ""}`)
            .join(" · ")}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-extrabold">{formatINR(Number(order.total))}</p>
          <div className="flex items-center gap-1">
            {canCancel && <CancelOrderButton orderId={order.id} total={formatINR(Number(order.total))} />}
            <a
              href={`/bill/${order.public_token}?print=1`}
              target="_blank"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Download bill
            </a>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My orders</h1>
        <Link
          href="/parent/order"
          className="flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 font-semibold text-white hover:bg-accent-600"
        >
          <Plus className="h-4 w-4" /> New order
        </Link>
      </div>

      {placed && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
          <CircleCheck className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">Order placed! Bill #{placed}. It&apos;s paid from your wallet.</p>
        </div>
      )}

      <h2 className="mt-8 font-bold text-slate-900">Upcoming</h2>
      {upcoming.length === 0 ? (
        <p className="mt-3 rounded-2xl border-2 border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
          No upcoming orders.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">{upcoming.map(card)}</ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 font-bold text-slate-900">Past</h2>
          <ul className="mt-3 space-y-3">{past.map(card)}</ul>
        </>
      )}
    </div>
  );
}
