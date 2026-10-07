"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginEmail, STAFF_EMAIL_DOMAIN } from "@/lib/staff-login";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string };

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    // Parents use their email; staff use their username.
    email: loginEmail(text(formData, "login")),
    password: String(formData.get("password") ?? ""),
  });

  if (error?.code === "email_not_confirmed") {
    return { error: "Please confirm your email first. Check your inbox for the link we sent." };
  }
  if (error) return { error: "Wrong email, username or password." };
  redirect("/");
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = text(formData, "full_name");
  const phone = text(formData, "phone");
  // One or more schools picked from the dropdown. The first becomes the account's main school.
  const schoolCodes = [
    ...new Set(formData.getAll("school_code").map((code) => String(code).trim().toUpperCase()).filter(Boolean)),
  ];
  const email = text(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email) return { error: "Please fill in all required fields." };
  if (schoolCodes.length === 0) return { error: "Please choose your school." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (email.toLowerCase().endsWith(`@${STAFF_EMAIL_DOMAIN}`)) return { error: "Please use your real email address." };

  const supabase = await createClient();

  const { data: schools } = await supabase.rpc("list_schools");
  const known = new Set(((schools ?? []) as { join_code: string }[]).map((s) => s.join_code));
  if (schoolCodes.some((code) => !known.has(code))) return { error: "Please choose schools from the list." };

  const headerList = await headers();
  const origin = headerList.get("origin") ?? `https://${headerList.get("host")}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone, school_code: schoolCodes[0], school_codes: schoolCodes },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) return { error: error.message };

  // If email confirmation is switched off in Supabase, the user is logged in straight away.
  if (data.session) redirect("/");
  return { message: "Almost done! Check your email and click the link to confirm your account." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
