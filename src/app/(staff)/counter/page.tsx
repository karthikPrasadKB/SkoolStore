import { requireRole } from "@/lib/auth";
import type { Category, FoodType, Product } from "@/lib/menu";
import { getSchool } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";
import { Pos, type PosProduct } from "./pos";

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

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export default async function CounterPage() {
  const profile = await requireRole(["admin", "canteen_staff", "counter_staff"]);
  const supabase = await createClient();
  const school = await getSchool();

  const [{ data: productRows }, { data: categoryRows }, { data: soldRows }] = await Promise.all([
    supabase
      .from("products")
      .select("*, option_groups(id, name, is_required, max_select, sort_order, options(id, name, price_delta, sort_order))")
      .eq("is_active", true)
      .eq("preorder_only", false)
      .order("name"),
    supabase.from("categories").select("id, name, sort_order").order("sort_order"),
    supabase.rpc("product_sold_on", { p_date: todayInIndia() }),
  ]);

  const sold = new Map(
    ((soldRows ?? []) as { product_id: string; quantity: number }[]).map((r) => [r.product_id, Number(r.quantity)]),
  );

  const products: PosProduct[] = ((productRows ?? []) as ProductRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    category_id: p.category_id,
    price: Number(p.price),
    food_type: p.food_type as FoodType,
    image_path: p.image_path,
    // How many can still be sold right now. null = no limit.
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

  const maxDiscountPercent =
    profile.role === "counter_staff" ? (school.counter_discount_allowed ? school.counter_max_discount_percent : 0) : 100;

  return (
    <Pos
      products={products}
      categories={(categoryRows ?? []) as Category[]}
      maxDiscountPercent={maxDiscountPercent}
      useCanteenCodes={school.use_canteen_codes}
    />
  );
}
