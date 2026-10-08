"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { homeFor, type Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

// Switch the school a staff member is working in. Everything they see then belongs to that school.
export async function switchSchool(schoolId: string) {
  const profile = await requireRole(["admin", "canteen_staff", "counter_staff"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_school", { p_school_id: schoolId });
  if (error) return { error: error.message };

  // Their role can differ per school (e.g. admin at one, counter staff at another).
  const { data } = await supabase.from("profiles").select("role").eq("id", profile.id).single();
  revalidatePath("/", "layout");
  redirect(homeFor((data?.role ?? "counter_staff") as Role));
}

export type NewSchoolState = { error?: string };

// An admin adds another school canteen. They become its admin and start working in it.
export async function createSchool(_prev: NewSchoolState, formData: FormData): Promise<NewSchoolState> {
  await requireRole(["admin"]);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Please enter the school name." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_school", { p_name: name });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  // New schools start with default settings: go straight to Settings to fill in the details.
  redirect("/admin/settings?new=1");
}
