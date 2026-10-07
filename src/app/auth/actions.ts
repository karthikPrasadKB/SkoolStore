"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string };

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: text(formData, "email"),
    password: String(formData.get("password") ?? ""),
  });

  if (error?.code === "email_not_confirmed") {
    return { error: "Please confirm your email first. Check your inbox for the link we sent." };
  }
  if (error) return { error: "Wrong email or password." };
  redirect("/");
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = text(formData, "full_name");
  const phone = text(formData, "phone");
  const schoolCode = text(formData, "school_code").toUpperCase();
  const email = text(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!fullName || !schoolCode || !email) return { error: "Please fill in all required fields." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();

  const { data: schools } = await supabase.rpc("find_school_by_code", { code: schoolCode });
  if (!schools?.length) return { error: "We couldn't find a school with that code." };

  const headerList = await headers();
  const origin = headerList.get("origin") ?? `https://${headerList.get("host")}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone, school_code: schoolCode },
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
