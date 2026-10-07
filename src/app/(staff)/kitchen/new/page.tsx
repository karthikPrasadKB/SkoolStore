import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import type { Category } from "@/lib/menu";
import { getSchool } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  await requireRole(["admin", "canteen_staff"]);
  const supabase = await createClient();
  const school = await getSchool();
  const { data } = await supabase.from("categories").select("id, name, sort_order").order("sort_order");

  return (
    <>
      <Link href="/kitchen" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to menu
      </Link>
      <PageHeader title="Add item" description="Add something new to your canteen menu." />
      <ProductForm groups={[]} categories={(data ?? []) as Category[]} defaultGstRate={school.gst_rate} schoolHours={school} />
    </>
  );
}
