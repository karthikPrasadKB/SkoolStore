import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { MenuProduct } from "@/components/customise-dialog";
import { requireRole } from "@/lib/auth";
import { dayOfWeek, deadlineText, orderDays, type CutoffRules } from "@/lib/dates";
import type { Category, FoodType, Product } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import { OrderBuilder } from "./order-builder";

type ChildRow = {
  id: string;
  full_name: string;
  class_name: string;
  school_id: string;
  school: (CutoffRules & { name: string }) | null;
};

type ProductRow = Product & {
  option_groups: {
    id: string;
    name: string;
    is_required: boolean;
    max_select: number;
    sort_order: number;
    options: { id: string; name: string; price_delta: number; sort_order: number }[];
  }[];
};

export default async function OrderPage({ searchParams }: PageProps<"/parent/order">) {
  const profile = await requireRole(["parent"]);
  const { child, date } = await searchParams;
  const supabase = await createClient();

  const { data: childRows } = await supabase
    .from("students")
    .select("id, full_name, class_name, school_id, school:schools(name, preorder_cutoff_time, preorder_cutoff_same_day, saturday_open)")
    .eq("parent_id", profile.id)
    .order("created_at");
  const children = (childRows ?? []) as unknown as ChildRow[];

  if (children.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-4xl">👧🧒</p>
        <h1 className="mt-4 text-2xl font-bold">Add your child first</h1>
        <p className="mt-2 text-slate-500">Orders are placed for a child, so add them on your home page.</p>
        <Link href="/parent" className="mt-6 inline-block rounded-xl bg-accent-500 px-5 py-3 font-semibold text-white hover:bg-accent-600">
          Go to my children
        </Link>
      </div>
    );
  }

  const selected = children.find((c) => c.id === child) ?? children[0];
  const school = selected.school!;
  const days = orderDays(school);
  const selectedDay = days.find((d) => d.date === date && d.open) ?? days.find((d) => d.open);
  const href = (childId: string, day?: string) => `/parent/order?child=${childId}${day ? `&date=${day}` : ""}`;

  const chip = (active: boolean, disabled = false) =>
    `whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-semibold transition ${
      disabled
        ? "cursor-not-allowed bg-slate-50 text-slate-300"
        : active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
    }`;

  let builder: React.ReactNode = (
    <div className="rounded-3xl border-2 border-dashed border-slate-200 px-6 py-14 text-center text-slate-500">
      Ordering is closed for the next few days. Please check back later.
    </div>
  );

  if (selectedDay) {
    const dow = dayOfWeek(selectedDay.date);
    const [{ data: productRows }, { data: categoryRows }, { data: soldRows }, { data: wallet }] = await Promise.all([
      supabase
        .from("products")
        .select("*, option_groups(id, name, is_required, max_select, sort_order, options(id, name, price_delta, sort_order))")
        .eq("school_id", selected.school_id)
        .eq("is_active", true)
        .order("name"),
      supabase.from("categories").select("id, name, sort_order").eq("school_id", selected.school_id).order("sort_order"),
      supabase.rpc("sold_for_date", { p_school_id: selected.school_id, p_date: selectedDay.date }),
      supabase.from("wallets").select("balance").eq("parent_id", profile.id).eq("school_id", selected.school_id).maybeSingle(),
    ]);

    const sold = new Map(
      ((soldRows ?? []) as { product_id: string; quantity: number }[]).map((r) => [r.product_id, Number(r.quantity)]),
    );
    // Only items sold on the chosen day.
    const products: MenuProduct[] = ((productRows ?? []) as ProductRow[])
      .filter((p) => p.available_days.length === 0 || p.available_days.includes(dow))
      .map((p) => ({
        id: p.id,
        name: p.name,
        category_id: p.category_id,
        price: Number(p.price),
        food_type: p.food_type as FoodType,
        image_path: p.image_path,
        remaining:
          p.stock_mode === "count"
            ? p.stock_qty
            : p.stock_mode === "daily_limit"
              ? Math.max(p.daily_limit - (sold.get(p.id) ?? 0), 0)
              : null,
        groups: [...p.option_groups]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((g) => ({
            id: g.id,
            name: g.name,
            is_required: g.is_required,
            max_select: g.max_select,
            options: [...g.options]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((o) => ({ id: o.id, name: o.name, price_delta: Number(o.price_delta) })),
          })),
      }));

    builder = (
      <OrderBuilder
        key={`${selected.id}-${selectedDay.date}`}
        products={products}
        categories={(categoryRows ?? []) as Category[]}
        balance={Number(wallet?.balance ?? 0)}
        studentId={selected.id}
        studentName={selected.full_name.split(" ")[0]}
        dayLabel={selectedDay.label}
        pickupDate={selectedDay.date}
        closesAt={deadlineText(selectedDay.deadline)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Order food</h1>

      <div className="mt-5 space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">For</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {children.map((c) => (
              <Link key={c.id} href={href(c.id, selectedDay?.date)} className={chip(c.id === selected.id)}>
                {c.full_name.split(" ")[0]}
                <span className="ml-1.5 font-normal opacity-70">
                  {c.class_name}
                  {children.some((o) => o.school_id !== c.school_id) && ` · ${c.school?.name}`}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <CalendarClock className="h-3.5 w-3.5" /> Pickup day
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) =>
              d.open ? (
                <Link key={d.date} href={href(selected.id, d.date)} className={chip(d.date === selectedDay?.date)}>
                  {d.label}
                </Link>
              ) : (
                <span key={d.date} className={chip(false, true)} title={d.reason}>
                  {d.label} · closed
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">{builder}</div>
    </div>
  );
}
