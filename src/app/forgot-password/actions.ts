"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ForgotState = { sent?: boolean; staff?: boolean; error?: string };

// Sends a password reset link to the email. The reply is the same whether or not an account exists,
// so this page can't be used to find out who has an account.
export async function sendResetLink(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const typed = String(formData.get("login") ?? "").trim();
  if (!typed) return { error: "Please enter your email." };

  // Staff log in with a username, which can't receive email: their admin resets it.
  if (!typed.includes("@")) return { staff: true };
  if (!/^\S+@\S+\.\S+$/.test(typed)) return { error: "That email doesn't look right." };

  const headerList = await headers();
  const origin = headerList.get("origin") ?? `https://${headerList.get("host")}`;
  const supabase = await createClient();
  // The email's link goes to /auth/confirm (see the email template setup in the README).
  await supabase.auth.resetPasswordForEmail(typed.toLowerCase(), { redirectTo: `${origin}/account/password` });
  return { sent: true };
}
