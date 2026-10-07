"use client";

import { useActionState } from "react";
import { signup, type FormState } from "@/app/auth/actions";
import { Alert, Button, Field } from "@/components/ui";

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, {});

  if (state.message) return <Alert kind="success">{state.message}</Alert>;

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Full name" name="full_name" autoComplete="name" required />
      <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" />
      <Field
        label="School code"
        name="school_code"
        required
        className="uppercase"
        hint="Ask your school canteen for this code."
      />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="At least 8 characters."
      />
      <Button type="submit" disabled={pending} className="w-full py-3">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
