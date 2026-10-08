import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// True if the logged-in person is a superadmin (organisation head). Cached for one request.
export const isPlatformAdmin = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
});

// Use at the top of every /hq page and action. Anyone else gets "Page not found",
// so the page looks like it doesn't exist.
export async function requirePlatformAdmin() {
  if (!(await isPlatformAdmin())) notFound();
}
