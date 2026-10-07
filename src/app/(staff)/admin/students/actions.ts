"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type StudentState = { error?: string; saved?: boolean };

export async function addStudent(_prev: StudentState, formData: FormData): Promise<StudentState> {
  const profile = await requireRole(["admin"]);
  const name = String(formData.get("full_name") ?? "").trim();
  if (!name) return { error: "Please enter the student's name." };

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    school_id: profile.school_id,
    full_name: name.slice(0, 100),
    class_name: String(formData.get("class_name") ?? "").trim().slice(0, 30),
    id_card_number: String(formData.get("id_card_number") ?? "").trim().slice(0, 30) || null,
  });

  if (error) {
    return {
      error: error.code === "23505" ? "Another student already has that ID card number." : error.message,
    };
  }
  revalidatePath("/admin/students");
  return { saved: true };
}

export async function deleteStudent(formData: FormData) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/students");
}

export async function updateStudent(_prev: StudentState, formData: FormData): Promise<StudentState> {
  await requireRole(["admin"]);
  const name = String(formData.get("full_name") ?? "").trim();
  if (!name) return { error: "Name can't be empty." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      full_name: name.slice(0, 100),
      class_name: String(formData.get("class_name") ?? "").trim().slice(0, 30),
      id_card_number: String(formData.get("id_card_number") ?? "").trim().slice(0, 30) || null,
    })
    .eq("id", String(formData.get("id")));

  if (error) {
    return {
      error: error.code === "23505" ? "Another student already has that ID card number." : error.message,
    };
  }
  revalidatePath("/admin/students");
  return { saved: true };
}
