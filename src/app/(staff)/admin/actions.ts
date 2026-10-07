"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type RoleState = { error?: string; saved?: boolean };

export async function changeRole(_prev: RoleState, formData: FormData): Promise<RoleState> {
  await requireRole(["admin"]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    member_id: String(formData.get("member_id")),
    new_role: String(formData.get("role")) as Role,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { saved: true };
}
