"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ChildState = { error?: string; saved?: boolean; duplicateId?: string };

// Reads the ID field. Without an ID card, parents make up a code of exactly 6 letters or numbers.
function readIdCard(formData: FormData): { value: string | null } | { error: string } {
  const raw = String(formData.get("id_card_number") ?? "").trim();
  if (formData.get("no_id_card") === "1") {
    const code = raw.toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return { error: "Your own code must be exactly 6 letters or numbers, e.g. AB12CD." };
    return { value: code };
  }
  return { value: raw.slice(0, 30) || null };
}

// Adds a child. An empty school code means the parent's own school.
export async function addChild(_prev: ChildState, formData: FormData): Promise<ChildState> {
  await requireRole(["parent"]);
  const name = String(formData.get("full_name") ?? "").trim();
  if (!name) return { error: "Please enter your child's name." };
  const idCard = readIdCard(formData);
  if ("error" in idCard) return idCard;

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_child", {
    p_full_name: name,
    p_class_name: String(formData.get("class_name") ?? "").trim(),
    p_school_code: String(formData.get("school_code") ?? "").trim(),
    p_id_card_number: idCard.value ?? "",
  });

  if (error) {
    return error.message.includes("already has ID card number")
      ? { error: error.message, duplicateId: idCard.value ?? undefined }
      : { error: error.message };
  }
  revalidatePath("/parent");
  return { saved: true };
}

export async function removeChild(formData: FormData) {
  await requireRole(["parent"]);
  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", String(formData.get("id")));
  revalidatePath("/parent");
}

// The child's ID card number, whether they may pay with the family wallet at the counter, and how much per day.
export async function saveChildSettings(_prev: ChildState, formData: FormData): Promise<ChildState> {
  await requireRole(["parent"]);
  const limitText = String(formData.get("daily_limit") ?? "").trim();
  const limit = limitText === "" ? null : Number(limitText);
  if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
    return { error: "Daily limit must be 0 or more, or empty for no limit." };
  }

  const idCard = readIdCard(formData);
  if ("error" in idCard) return idCard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      id_card_number: idCard.value,
      wallet_allowed: formData.get("wallet_allowed") === "on",
      wallet_daily_limit: limit === null ? null : Math.round(limit * 100) / 100,
    })
    .eq("id", String(formData.get("id")));

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That ID number or code is already used by another student at this school. Please choose a different one."
          : error.message,
      duplicateId: error.code === "23505" ? (idCard.value ?? undefined) : undefined,
    };
  }
  // Moving to a different school is checked by the database (no upcoming pre-orders, ID number free there).
  const schoolCode = String(formData.get("school_code") ?? "").trim();
  if (schoolCode && schoolCode !== String(formData.get("current_school_code") ?? "")) {
    const { error: moveError } = await supabase.rpc("change_child_school", {
      p_student_id: String(formData.get("id")),
      p_school_code: schoolCode,
    });
    if (moveError) {
      return moveError.message.includes("already has ID card number")
        ? { error: moveError.message, duplicateId: idCard.value ?? undefined }
        : { error: moveError.message };
    }
  }

  revalidatePath("/parent", "layout");
  return { saved: true };
}

export type RequestState = { error?: string; sent?: boolean };

// A message from the parent to a school's admin, e.g. when their child's ID number is already taken.
export async function sendSupportRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const profile = await requireRole(["parent"]);
  const field = (key: string) => String(formData.get(key) ?? "").trim();
  const phone = field("phone");
  const email = field("email");
  const message = field("message");

  if (phone.replace(/\D/g, "").length < 10) return { error: "Please enter a valid phone number." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email." };
  if (message.length < 5) return { error: "Please describe the problem." };

  const supabase = await createClient();
  const { error } = await supabase.from("support_requests").insert({
    school_id: field("school_id"),
    parent_id: profile.id,
    phone: phone.slice(0, 20),
    email: email.slice(0, 320),
    id_card_number: field("id_card_number").slice(0, 30) || null,
    message: message.slice(0, 2000),
  });

  if (error) return { error: "Sorry, the message couldn't be sent. Please try again." };
  revalidatePath("/parent");
  return { sent: true };
}

export type PreorderInput = {
  student_id: string;
  pickup_date: string;
  slot_id: string | null;
  items: { product_id: string; quantity: number; option_ids: string[] }[];
};

export type PreorderResult = { ok: true; bill_number: number; total: number } | { ok: false; error: string };

// Places a pre-order for a child, paid from the family wallet at the child's school.
export async function placePreorder(order: PreorderInput): Promise<PreorderResult> {
  await requireRole(["parent"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_preorder", {
    p_student_id: order.student_id,
    p_pickup_date: order.pickup_date,
    p_items: order.items,
    p_payment_method: "wallet",
    p_slot_id: order.slot_id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parent", "layout");
  return { ok: true, bill_number: data.bill_number, total: Number(data.total) };
}

export type CancelState = { error?: string };

export async function cancelPreorder(_prev: CancelState, formData: FormData): Promise<CancelState> {
  await requireRole(["parent"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_preorder", { p_order_id: String(formData.get("order_id")) });
  if (error) return { error: error.message };
  revalidatePath("/parent", "layout");
  return {};
}
