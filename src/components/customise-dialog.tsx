"use client";

import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { FoodTypeMark } from "@/components/food-type-mark";
import { formatINR, type FoodType } from "@/lib/menu";

// An item as shown on a menu (counter or parent ordering).
export type MenuOption = { id: string; name: string; price_delta: number };
export type MenuGroup = { id: string; name: string; is_required: boolean; max_select: number; options: MenuOption[] };
export type MenuProduct = {
  id: string;
  name: string;
  category_id: string | null;
  price: number;
  food_type: FoodType;
  image_path: string | null;
  remaining: number | null;
  groups: MenuGroup[];
};

// Pop-up for choosing an item's customisations (size, add-ons) and quantity.
export function CustomiseDialog({
  product,
  remaining,
  onClose,
  onAdd,
}: {
  product: MenuProduct;
  remaining: number | null;
  onClose: () => void;
  onAdd: (options: MenuOption[], quantity: number) => void;
}) {
  // Start with the first choice picked in required pick-one groups (the common case).
  const [chosen, setChosen] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      product.groups.map((g) => [g.id, g.is_required && g.max_select === 1 && g.options[0] ? [g.options[0].id] : []]),
    ),
  );
  const [quantity, setQuantity] = useState(1);

  function toggle(group: MenuGroup, optionId: string) {
    setChosen((current) => {
      const selected = current[group.id] ?? [];
      if (group.max_select === 1) return { ...current, [group.id]: [optionId] };
      if (selected.includes(optionId)) return { ...current, [group.id]: selected.filter((id) => id !== optionId) };
      if (selected.length >= group.max_select) return current;
      return { ...current, [group.id]: [...selected, optionId] };
    });
  }

  const selectedOptions = product.groups.flatMap((g) => g.options.filter((o) => chosen[g.id]?.includes(o.id)));
  const missing = product.groups.filter((g) => g.is_required && !(chosen[g.id]?.length));
  const unitPrice = product.price + selectedOptions.reduce((sum, o) => sum + o.price_delta, 0);
  const maxQuantity = remaining ?? 99;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="flex items-center gap-2 text-lg font-bold">
              <FoodTypeMark type={product.food_type} /> {product.name}
            </p>
            <p className="text-sm text-slate-500">{formatINR(product.price)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {product.groups.map((group) => (
            <div key={group.id}>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                {group.name}
                <span className="text-xs font-medium text-slate-400">
                  {group.is_required ? "Required" : "Optional"}
                  {group.max_select > 1 && ` · up to ${group.max_select}`}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.options.map((option) => {
                  const active = chosen[group.id]?.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => toggle(group, option.id)}
                      className={`rounded-xl border-2 px-3 py-2.5 text-left text-sm transition ${
                        active ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="block font-semibold text-slate-900">{option.name}</span>
                      <span className="text-xs text-slate-500">
                        {option.price_delta > 0 ? `+${formatINR(option.price_delta)}` : "No extra cost"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="rounded-lg p-2 hover:bg-white" title="One less">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-bold">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              disabled={quantity >= maxQuantity}
              className="rounded-lg p-2 hover:bg-white disabled:opacity-30"
              title="One more"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => onAdd(selectedOptions, quantity)}
            disabled={missing.length > 0 || maxQuantity < 1}
            className="flex-1 rounded-xl bg-brand-600 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {missing.length > 0 ? `Choose ${missing[0].name}` : `Add · ${formatINR(unitPrice * quantity)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
