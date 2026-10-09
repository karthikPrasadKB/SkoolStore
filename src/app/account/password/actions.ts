"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { error?: string };

// Changes the logged-in person's password. First-time (temporary) passwords skip the "current password" check.
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const firstTime = claims.user_metadata?.must_change_password === true;

  if (next.length < 8) return { error: "The new password must be at least 8 characters." };
  if (next !== confirm) return { error: "The two new passwords don't match." };

  if (!firstTime) {
    // Check the current password by signing in with it.
    const { error } = await supabase.auth.signInWithPassword({ email: String(claims.email), password: current });
    if (error) return { error: "Your current password isn't right." };
  }
  if (next === current) return { error: "Please choose a different password from the current one." };

  const { error } = await supabase.auth.updateUser({
    password: next,
    data: { must_change_password: false, password_reset: false },
  });
  if (error) return { error: error.message };

  // Refresh the login so the "must change password" flag is cleared straight away.
  await supabase.auth.refreshSession();
  redirect("/?password=changed");
}
