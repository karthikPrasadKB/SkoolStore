"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ChildState = { error?: string; saved?: boolean };

export async function addChild(_prev: ChildState, formData: FormData): Promise<ChildState> {
  const profile = await requireRole(["parent"]);
  const name = String(formData.get("full_name") ?? "").trim();
  const className = String(formData.get("class_name") ?? "").trim();
  if (!name) return { error: "Please enter your child's name." };

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    school_id: profile.school_id,
    parent_id: profile.id,
    full_name: name.slice(0, 100),
    class_name: className.slice(0, 30),
  });

  if (error) return { error: error.message };
  revalidatePath("/parent");
  return { saved: true };
}

export async function removeChild(formData: FormData) {
  await requireRole(["parent"]);
  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", String(formData.get("id")));
  revalidatePath("/parent");
}
