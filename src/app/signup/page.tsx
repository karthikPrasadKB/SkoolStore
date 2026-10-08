import { AuthLink, AuthShell } from "@/components/auth-shell";
import type { School } from "@/components/school-picker";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_schools");

  return (
    <AuthShell
      title="Create your account"
      subtitle="Order school canteen food for your children."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Log in</AuthLink>
        </>
      }
    >
      <SignupForm schools={(data ?? []) as School[]} />
    </AuthShell>
  );
}
