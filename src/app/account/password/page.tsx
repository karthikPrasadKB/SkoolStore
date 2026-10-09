import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export default async function PasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const firstTime = data.claims.user_metadata?.must_change_password === true;
  // Arrived from a "Forgot password" email rather than a temporary password.
  const fromReset = data.claims.user_metadata?.password_reset === true;

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-4 py-16">
      <Logo />
      <Card className="mt-8 w-full max-w-md p-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {fromReset ? "Choose a new password" : firstTime ? "Set your own password" : "Change password"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {fromReset
                ? "Your reset link worked. Choose a new password to continue."
                : firstTime
                  ? "You logged in with a temporary password. Choose your own to continue. Only you will know it."
                  : "Choose a new password for your account."}
            </p>
          </div>
        </div>
        <PasswordForm firstTime={firstTime} />
      </Card>
      {!firstTime && (
        <Link href="/" className="mt-6 text-sm font-semibold text-slate-500 hover:text-slate-800">
          ← Back
        </Link>
      )}
    </main>
  );
}
