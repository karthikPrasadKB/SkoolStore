"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FirstSchoolState = { error?: string };

// A new client admin creates their first school; they become its admin.
export async function createFirstSchool(_prev: FirstSchoolState, formData: FormData): Promise<FirstSchoolState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Please enter the school name." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_first_school", { p_name: name });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/admin/settings?new=1");
}
