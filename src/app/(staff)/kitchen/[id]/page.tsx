import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import type { Category, OptionGroupInput, Product } from "@/lib/menu";
import { getSchool } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";
import { deleteProduct } from "../actions";
import { ProductForm } from "../product-form";
import { ConfirmButton } from "@/components/confirm-button";

type GroupRow = OptionGroupInput & { sort_order: number; options: (OptionGroupInput["options"][number] & { sort_order: number })[] };

export default async function EditProductPage({ params }: PageProps<"/kitchen/[id]">) {
  await requireRole(["admin", "canteen_staff"]);
  const { id } = await params;
  const supabase = await createClient();
  const school = await getSchool();

  const [{ data: product }, { data: categories }, { data: groupRows }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name, sort_order").order("sort_order"),
    supabase
      .from("option_groups")
      .select("name, is_required, max_select, sort_order, options(name, price_delta, sort_order)")
      .eq("product_id", id)
      .order("sort_order"),
  ]);
  if (!product) notFound();

  const groups = ((groupRows ?? []) as GroupRow[]).map((group) => ({
    name: group.name,
    is_required: group.is_required,
    max_select: group.max_select,
    options: [...group.options]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((option) => ({ name: option.name, price_delta: Number(option.price_delta) })),
  }));

  return (
    <>
      <Link href="/kitchen" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to menu
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={`Edit ${product.name}`} />
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={product.id} />
          <ConfirmButton message={`Delete "${product.name}"? This can't be undone.`}>
            <Trash2 className="h-4 w-4" /> Delete item
          </ConfirmButton>
        </form>
      </div>
      <ProductForm
        product={{
          ...(product as Product),
          price: Number(product.price),
          gst_rate: product.gst_rate === null ? null : Number(product.gst_rate),
        }}
        groups={groups}
        categories={(categories ?? []) as Category[]}
        defaultGstRate={school.gst_rate}
        schoolHours={school}
      />
    </>
  );
}
