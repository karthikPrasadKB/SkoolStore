"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SaleInput = {
  items: { product_id: string; quantity: number; option_ids: string[] }[];
  payment_method: "cash" | "upi" | "pluxee" | "wallet";
  amount_received: number | null;
  discount_amount: number;
  discount_reason: string;
  customer_name: string;
  customer_phone: string;
  student_code: string;
};

export type SaleResult =
  | { ok: true; bill_number: number; public_token: string; total: number; change: number }
  | { ok: false; error: string };

export async function createCounterOrder(sale: SaleInput): Promise<SaleResult> {
  await requireRole(["admin", "canteen_staff", "counter_staff"]);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_counter_order", {
    p_items: sale.items,
    p_payment_method: sale.payment_method,
    p_amount_received: sale.amount_received,
    p_discount_amount: sale.discount_amount,
    p_discount_reason: sale.discount_reason,
    p_customer_name: sale.customer_name,
    p_customer_phone: sale.customer_phone,
    p_student_code: sale.student_code,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/counter", "layout");
  revalidatePath("/kitchen");
  return {
    ok: true,
    bill_number: data.bill_number,
    public_token: data.public_token,
    total: Number(data.total),
    change: Number(data.change),
  };
}

export type CancelState = { error?: string; done?: boolean };

// Only the school admin can cancel a bill, and must give a reason.
export async function cancelOrder(_prev: CancelState, formData: FormData): Promise<CancelState> {
  await requireRole(["admin"]);
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: "Please give a reason." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: String(formData.get("id")),
    p_reason: reason,
  });

  if (error) return { error: error.message };
  revalidatePath("/counter", "layout");
  revalidatePath("/kitchen");
  return { done: true };
}

export type StudentMatch = {
  name: string;
  class_name: string;
  code: string;
  id_card_number: string | null;
  has_wallet: boolean;
  balance: number;
  wallet_allowed: boolean;
  daily_limit: number | null;
  spent_today: number;
} | null;

// Finds a student by their ID card number (or store code, if the school uses codes),
// with their family wallet details, so the biller can confirm who it is.
export async function lookupStudent(idOrCode: string): Promise<StudentMatch> {
  await requireRole(["admin", "canteen_staff", "counter_staff"]);
  const clean = idOrCode.trim().toUpperCase();
  if (!clean || clean.length > 30) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("counter_student_lookup", { p_code: clean });
  if (!data) return null;
  return {
    ...data,
    balance: Number(data.balance),
    daily_limit: data.daily_limit === null ? null : Number(data.daily_limit),
    spent_today: Number(data.spent_today),
  };
}

export type TopUpResult = { ok: true; balance: number } | { ok: false; error: string };

// Adds money to the family wallet of the student with this code (paid at the counter by cash or UPI).
export async function topUpWallet(code: string, amount: number, method: "cash" | "upi"): Promise<TopUpResult> {
  await requireRole(["admin", "canteen_staff", "counter_staff"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("topup_wallet", {
    p_student_code: code,
    p_amount: amount,
    p_method: method,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/counter", "layout");
  return { ok: true, balance: Number(data.balance) };
}

// Turns "+91 98765-43210" or "098765 43210" into "9876543210". Null if not a valid Indian mobile.
function normalizePhone(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export type CustomerMatch = { found: boolean; phone: string; name: string | null } | null;

// Looks up a walk-in customer by phone. found = false means they'll be saved as a new customer.
export async function lookupCustomer(phone: string): Promise<CustomerMatch> {
  await requireRole(["admin", "canteen_staff", "counter_staff"]);
  const clean = normalizePhone(phone);
  if (!clean) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("name").eq("phone", clean).maybeSingle();
  return { found: Boolean(data), phone: clean, name: data?.name ?? null };
}
