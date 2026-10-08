"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Marks a pre-order as handed over (or undoes it if tapped by mistake).
export async function setCollected(orderId: string, collected: boolean): Promise<{ error?: string }> {
  await requireRole(["admin", "canteen_staff", "counter_staff"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_collected", { p_order_id: orderId, p_collected: collected });
  if (error) return { error: error.message };
  revalidatePath("/counter/preorders");
  return {};
}
