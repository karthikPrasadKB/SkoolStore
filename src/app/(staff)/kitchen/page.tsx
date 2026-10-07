import Image from "next/image";
import Link from "next/link";
import { ChevronRight, FolderCog, Plus, Search, UtensilsCrossed } from "lucide-react";
import { FoodTypeMark } from "@/components/food-type-mark";
import { buttonClass, Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { availabilityText, formatINR, imageUrl, stockStatus, type Category, type Product } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import { StockEditor, VisibilityToggle } from "./stock-editor";

type Row = Product & { option_groups: { count: number }[] };

export default async function KitchenPage({ searchParams }: PageProps<"/kitchen">) {
  const profile = await requireRole(["admin", "canteen_staff", "counter_staff"]);
  const canEdit = profile.role !== "counter_staff";
  const { category, q } = await searchParams;
  const categoryId = typeof category === "string" ? category : undefined;
  const search = typeof q === "string" ? q.trim() : "";

  const supabase = await createClient();
  let query = supabase.from("products").select("*, option_groups(count)").order("name");
  if (categoryId === "none") query = query.is("category_id", null);
  else if (categoryId) query = query.eq("category_id", categoryId);
  if (search) query = query.ilike("name", `%${search.replace(/[%_]/g, "")}%`);

  const [{ data: productRows }, { data: categoryRows }, { data: allStock }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name, sort_order").order("sort_order"),
    supabase.from("products").select("stock_mode, stock_qty, daily_limit, low_stock_threshold, is_active"),
  ]);
  const products = (productRows ?? []) as Row[];
  const categories = (categoryRows ?? []) as Category[];
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const stockRows = (allStock ?? []) as Product[];
  const lowCount = stockRows.filter((p) => p.is_active && ["amber", "red"].includes(stockStatus(p).tone)).length;

  const tabHref = (id?: string) => {
    const params = new URLSearchParams();
    if (id) params.set("category", id);
    if (search) params.set("q", search);
    const qs = params.toString();
    return qs ? `/kitchen?${qs}` : "/kitchen";
  };
  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
      active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
    }`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Menu & stock"
          description={
            canEdit ? "Add items, set prices and keep stock up to date." : "Update stock numbers and show or hide items."
          }
        />
        {canEdit && (
          <div className="flex gap-2">
            <Link href="/kitchen/categories" className={buttonClass("outline")}>
              <FolderCog className="h-4 w-4" /> Categories
            </Link>
            <Link href="/kitchen/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> Add item
            </Link>
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-2xl font-bold">{stockRows.length}</p>
          <p className="text-sm text-slate-500">Items on the menu</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold">{stockRows.filter((p) => !p.is_active).length}</p>
          <p className="text-sm text-slate-500">Hidden items</p>
        </Card>
        <Card className={`p-5 ${lowCount ? "border-amber-300 bg-amber-50" : ""}`}>
          <p className={`text-2xl font-bold ${lowCount ? "text-amber-700" : ""}`}>{lowCount}</p>
          <p className="text-sm text-slate-500">Low or out of stock</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
          <Link href={tabHref()} className={tabClass(!categoryId)}>All</Link>
          {categories.map((c) => (
            <Link key={c.id} href={tabHref(c.id)} className={tabClass(categoryId === c.id)}>
              {c.name}
            </Link>
          ))}
          <Link href={tabHref("none")} className={tabClass(categoryId === "none")}>No category</Link>
        </div>
        <form action="/kitchen" className="relative w-full sm:w-64">
          {categoryId && <input type="hidden" name="category" value={categoryId} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Search items"
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </form>
      </div>

      {products.length === 0 ? (
        <Card className="flex flex-col items-center py-16 text-center">
          <div className="rounded-2xl bg-brand-50 p-4 text-brand-600">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
          <p className="mt-4 font-semibold text-slate-900">
            {search || categoryId ? "No items match" : "No items yet"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {search || categoryId
              ? "Try a different search or category."
              : canEdit
                ? "Add your first item to start building the menu."
                : "Canteen staff haven't added any items yet."}
          </p>
          {canEdit && !search && !categoryId && (
            <Link href="/kitchen/new" className={buttonClass("primary", "mt-6")}>
              <Plus className="h-4 w-4" /> Add item
            </Link>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Item</th>
                  <th className="px-5 py-3 font-semibold">Price</th>
                  <th className="px-5 py-3 font-semibold">Stock</th>
                  <th className="px-5 py-3 font-semibold">Sold</th>
                  <th className="px-5 py-3 font-semibold">Show</th>
                  {canEdit && <th className="w-10 px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
                  const src = imageUrl(product.image_path);
                  const optionCount = product.option_groups[0]?.count ?? 0;
                  return (
                    <tr key={product.id} className={`hover:bg-slate-50/60 ${product.is_active ? "" : "opacity-60"}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {src ? (
                              <Image src={src} alt="" fill sizes="48px" className="object-cover" />
                            ) : (
                              <UtensilsCrossed className="absolute inset-0 m-auto h-5 w-5 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                              <FoodTypeMark type={product.food_type} className="h-3.5 w-3.5" />
                              <span className="truncate">{product.name}</span>
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {(product.category_id && categoryName.get(product.category_id)) || "No category"}
                              {optionCount > 0 && ` · ${optionCount} customisation${optionCount > 1 ? "s" : ""}`}
                              {product.preorder_only && (
                                <span className="ml-1.5 rounded-full bg-accent-50 px-2 py-0.5 font-semibold text-accent-600">
                                  Pre-order only
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-900">
                        {formatINR(Number(product.price))}
                      </td>
                      <td className="px-5 py-3">
                        <StockEditor product={product} />
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">{availabilityText(product)}</td>
                      <td className="px-5 py-3">
                        <VisibilityToggle product={product} />
                      </td>
                      {canEdit && (
                        <td className="px-5 py-3">
                          <Link
                            href={`/kitchen/${product.id}`}
                            className="flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit item"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
