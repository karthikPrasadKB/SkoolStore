"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ReplyState = { error?: string; done?: boolean };

// Saves the admin's reply and marks the request resolved.
export async function resolveRequest(_prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const profile = await requireRole(["admin"]);
  const reply = String(formData.get("reply") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_requests")
    .update({
      status: "resolved",
      admin_reply: reply.slice(0, 2000) || null,
      resolved_at: new Date().toISOString(),
      resolved_by: profile.id,
    })
    .eq("id", String(formData.get("id")));

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { done: true };
}
