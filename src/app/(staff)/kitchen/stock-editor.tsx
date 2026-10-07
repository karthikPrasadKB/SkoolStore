"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { stockStatus, type Product } from "@/lib/menu";
import { updateStock, type ActionState } from "./actions";

const TONES = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-600",
};

type StockProduct = Pick<
  Product,
  "id" | "stock_mode" | "stock_qty" | "daily_limit" | "low_stock_threshold" | "is_active"
>;

// Stock badge with an inline editor, so staff can update numbers without opening the item.
export function StockEditor({ product }: { product: StockProduct }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await updateStock(prev, formData);
    if (result.saved) setEditing(false);
    return result;
  }, {});
  const status = stockStatus(product);

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[status.tone]}`}>
          {status.label}
        </span>
        {product.stock_mode !== "unlimited" && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Update stock"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  const isCount = product.stock_mode === "count";
  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="is_active" value={product.is_active ? "on" : ""} />
      <input type="hidden" name={isCount ? "daily_limit" : "stock_qty"} value={isCount ? product.daily_limit : product.stock_qty} />
      <input
        type="number"
        name={isCount ? "stock_qty" : "daily_limit"}
        defaultValue={isCount ? product.stock_qty : product.daily_limit}
        min="0"
        step="1"
        autoFocus
        aria-label={isCount ? "Quantity in stock" : "Number per day"}
        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
      />
      <button disabled={pending} className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        {pending ? "…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="px-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
        Cancel
      </button>
      {state.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

// On/off switch for showing an item on the menu.
export function VisibilityToggle({ product }: { product: StockProduct }) {
  const [, action, pending] = useActionState<ActionState, FormData>(updateStock, {});

  return (
    <form action={action}>
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="stock_qty" value={product.stock_qty} />
      <input type="hidden" name="daily_limit" value={product.daily_limit} />
      <input type="hidden" name="is_active" value={product.is_active ? "" : "on"} />
      <button
        disabled={pending}
        role="switch"
        aria-checked={product.is_active}
        title={product.is_active ? "Shown on menu. Click to hide." : "Hidden. Click to show on menu."}
        className={`relative h-6 w-11 rounded-full transition disabled:opacity-60 ${product.is_active ? "bg-emerald-500" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${product.is_active ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </form>
  );
}
