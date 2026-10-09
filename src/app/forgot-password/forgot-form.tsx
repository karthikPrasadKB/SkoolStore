"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck, UserRound } from "lucide-react";
import { Alert, Button, Field } from "@/components/ui";
import { sendResetLink, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(sendResetLink, {});

  if (state.sent) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto h-12 w-12 text-emerald-500" />
        <p className="mt-3 font-semibold text-slate-900">Check your email</p>
        <p className="mt-1 text-sm text-slate-600">
          If an account uses that email, we&apos;ve sent a link to reset your password. It may take a minute, and can
          land in spam.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Didn&apos;t get anything? You may not have an account yet.{" "}
          <Link href="/signup" className="font-semibold text-brand-600 hover:underline">
            Create one here
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.staff && (
        <div className="flex gap-3 rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
          <UserRound className="h-5 w-5 shrink-0 text-sky-600" />
          <p>
            That looks like a staff username. Staff passwords are reset by your school admin: please ask them to reset
            it for you.
          </p>
        </div>
      )}
      <Field
        label="Your email"
        name="login"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        hint="Staff who log in with a username: ask your school admin to reset your password."
      />
      <Button type="submit" disabled={pending} className="w-full py-3">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
