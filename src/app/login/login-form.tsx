"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type FormState } from "@/app/auth/actions";
import { Alert, Button, Field } from "@/components/ui";

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      {linkError && <Alert kind="error">That link has expired. Please log in or sign up again.</Alert>}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field
        label="Email or username"
        name="login"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
      />
      <div>
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <Link
          href="/forgot-password"
          className="mt-1.5 inline-block text-sm font-semibold text-brand-600 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <Button type="submit" disabled={pending} className="w-full py-3">
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
