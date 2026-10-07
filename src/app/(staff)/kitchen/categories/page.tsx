import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteCategory, moveCategory } from "../actions";
import { AddCategoryForm, RenameCategoryForm } from "./category-forms";

type CategoryRow = { id: string; name: string; products: { count: number }[] };

export default async function CategoriesPage() {
  await requireRole(["admin", "canteen_staff"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, products(count)")
    .order("sort_order")
    .order("name");
  const categories = (data ?? []) as CategoryRow[];

  const iconButton = "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30";

  return (
    <div className="max-w-2xl">
      <Link href="/kitchen" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to menu
      </Link>
      <PageHeader
        title="Categories"
        description="Group your menu into sections. Parents see them in this order."
      />

      <Card>
        <AddCategoryForm />
      </Card>

      <Card className="mt-6 p-0">
        {categories.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">No categories yet. Add your first one above.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((category, index) => {
              const itemCount = category.products[0]?.count ?? 0;
              return (
                <li key={category.id} className="flex items-center gap-2 px-4 py-3">
                  <div className="flex flex-col">
                    <form action={moveCategory}>
                      <input type="hidden" name="id" value={category.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button disabled={index === 0} className={iconButton} title="Move up">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                    </form>
                    <form action={moveCategory}>
                      <input type="hidden" name="id" value={category.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button disabled={index === categories.length - 1} className={iconButton} title="Move down">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                  <RenameCategoryForm id={category.id} name={category.name} />
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {itemCount} item{itemCount === 1 ? "" : "s"}
                  </span>
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <ConfirmButton
                      message={`Delete "${category.name}"? Its ${itemCount} item(s) will stay on the menu without a category.`}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </ConfirmButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
