import { cache } from "react";
import { redirect } from "next/navigation";
import { homeFor, type Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  school_id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  school: { name: string; join_code: string; is_disabled: boolean };
  // True if this person is locked out of the school they're working in: its client was disabled from HQ,
  // or the school itself was disabled and they aren't one of its admins.
  school_disabled: boolean;
};

// The logged-in user's profile, or null. Cached for the duration of one request.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return null;

  const { data } = await supabase
    .from("profiles")
    // Name the link explicitly: profiles also reach schools through parent_schools.
    .select("id, school_id, role, full_name, phone, school:schools!profiles_school_id_fkey(name, join_code, is_disabled)")
    .eq("id", auth.claims.sub)
    .single();

  if (!data) return null;
  const { data: disabled } = await supabase.rpc("access_paused_at", { p_school_id: data.school_id });
  return { ...(data as unknown as Omit<Profile, "school_disabled">), school_disabled: disabled === true };
});

// Use at the top of a page or action: sends the user away unless they have one of these roles.
export async function requireRole(roles: readonly Role[]) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  // Staff of a disabled client can't use SkoolStore.
  if (profile.role !== "parent" && profile.school_disabled) redirect("/paused");
  if (!roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}
