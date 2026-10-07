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
  school: { name: string; join_code: string };
};

// The logged-in user's profile, or null. Cached for the duration of one request.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return null;

  const { data } = await supabase
    .from("profiles")
    // Name the link explicitly: profiles also reach schools through parent_schools.
    .select("id, school_id, role, full_name, phone, school:schools!profiles_school_id_fkey(name, join_code)")
    .eq("id", auth.claims.sub)
    .single();

  return data as Profile | null;
});

// Use at the top of a page or action: sends the user away unless they have one of these roles.
export async function requireRole(roles: readonly Role[]) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}
