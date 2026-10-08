"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { changePassword, type PasswordState } from "./actions";

export function PasswordForm({ firstTime }: { firstTime: boolean }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {/* First time: they just logged in with the temporary password, so it isn't asked again. */}
      {!firstTime && (
        <Field label="Current password" name="current" type="password" autoComplete="current-password" required />
      )}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="At least 8 characters."
      />
      <Field
        label="New password again"
        name="confirm"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Button type="submit" disabled={pending} className="w-full py-3">
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
