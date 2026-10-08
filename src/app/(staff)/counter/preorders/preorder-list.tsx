"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Search, Undo2 } from "lucide-react";
import { formatTime } from "@/lib/menu";
import { setCollected } from "./actions";

export type PreorderRow = {
  id: string;
  status: string;
  student: { full_name: string; class_name: string; id_card_number: string | null } | null;
  slot: { id: string; name: string; starts_at: string } | null;
  items: { name: string; quantity: number; options: { name: string }[] }[];
};

// Today's pre-orders, A–Z by first name, with instant search for a quick handover.
export function PreorderList({ orders: initial }: { orders: PreorderRow[] }) {
  const [orders, setOrders] = useState(initial);
  const [search, setSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const slots = useMemo(() => {
    const map = new Map<string, { id: string; name: string; starts_at: string; count: number }>();
    for (const o of orders) {
      if (!o.slot) continue;
      const entry = map.get(o.slot.id) ?? { ...o.slot, count: 0 };
      entry.count += 1;
      map.set(o.slot.id, entry);
    }
    return [...map.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [orders]);

  const term = search.trim().toLowerCase();
  const visible = orders
    .filter((o) => !slotFilter || o.slot?.id === slotFilter)
    .filter((o) => {
      if (!term) return true;
      const s = o.student;
      return (
        s?.full_name.toLowerCase().includes(term) ||
        s?.class_name.toLowerCase().includes(term) ||
        s?.id_card_number?.toLowerCase().includes(term)
      );
    })
    // Waiting first, then handed over; each A–Z by first name.
    .sort(
      (a, b) =>
        Number(a.status === "collected") - Number(b.status === "collected") ||
        (a.student?.full_name ?? "").localeCompare(b.student?.full_name ?? ""),
    );

  const collectedCount = orders.filter((o) => o.status === "collected").length;

  function toggle(order: PreorderRow) {
    const collected = order.status !== "collected";
    setError(null);
    // Update the screen straight away; put it back if saving fails.
    setOrders((current) => current.map((o) => (o.id === order.id ? { ...o, status: collected ? "collected" : "paid" } : o)));
    startTransition(async () => {
      const result = await setCollected(order.id, collected);
      if (result.error) {
        setError(result.error);
        setOrders((current) => current.map((o) => (o.id === order.id ? { ...o, status: order.status } : o)));
      }
    });
    if (collected) setSearch("");
  }

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
      active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
    }`;

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 bg-slate-50/95 px-4 pb-3 pt-1 backdrop-blur md:-mx-10 md:px-10">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            placeholder="Type a name, class or ID number…"
            className="w-full rounded-2xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-lg outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setSlotFilter(null)} className={chip(slotFilter === null)}>
            All ({orders.length})
          </button>
          {slots.map((slot) => (
            <button key={slot.id} onClick={() => setSlotFilter(slot.id)} className={chip(slotFilter === slot.id)}>
              {slot.name} · {formatTime(slot.starts_at)} ({slot.count})
            </button>
          ))}
          <span className="ml-auto text-sm font-semibold text-slate-600">
            {collectedCount} of {orders.length} handed over
          </span>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 rounded-2xl border-2 border-dashed border-slate-200 px-6 py-12 text-center text-slate-500">
          {orders.length === 0 ? "No pre-orders for this day." : "No one matches."}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {visible.map((order) => {
            const done = order.status === "collected";
            return (
              <li
                key={order.id}
                className={`flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4 ${
                  done ? "border-slate-200 opacity-60" : "border-slate-200 shadow-sm"
                }`}
              >
                <div className="min-w-48 flex-1">
                  <p className="text-lg font-bold text-slate-900">{order.student?.full_name ?? "—"}</p>
                  <p className="text-sm text-slate-500">
                    {order.student?.class_name || "No class"}
                    {order.student?.id_card_number && ` · ID ${order.student.id_card_number}`}
                    {order.slot && ` · ${order.slot.name}`}
                  </p>
                </div>
                <ul className="min-w-48 flex-[2] text-sm text-slate-800">
                  {order.items.map((item, i) => (
                    <li key={i}>
                      <span className="font-bold">{item.quantity}×</span> {item.name}
                      {item.options.length > 0 && (
                        <span className="text-slate-500"> ({item.options.map((o) => o.name).join(", ")})</span>
                      )}
                    </li>
                  ))}
                </ul>
                {done ? (
                  <button
                    onClick={() => toggle(order)}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
                  >
                    <Undo2 className="h-4 w-4" /> Undo
                  </button>
                ) : (
                  <button
                    onClick={() => toggle(order)}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white hover:bg-emerald-700"
                  >
                    <Check className="h-5 w-5" /> Handed over
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
