"use client";

import { useActionState } from "react";
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
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" disabled={pending} className="w-full py-3">
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
