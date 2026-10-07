"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { resetStaffPassword, type PasswordState } from "./actions";

// Lets the admin set a new password for a staff member (staff may not have an email to reset it themselves).
export function ResetPassword({ memberId, name }: { memberId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PasswordState, FormData>(async (prev, formData) => {
    const result = await resetStaffPassword(prev, formData);
    if (result.done) setOpen(false);
    return result;
  }, {});

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        {state.done && <span className="text-xs text-emerald-700">Password changed</span>}
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title={`Reset ${name}'s password`}
        >
          <KeyRound className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="member_id" value={memberId} />
      <input
        name="password"
        type="text"
        required
        minLength={8}
        autoFocus
        autoComplete="off"
        placeholder="New password"
        className="w-36 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
      />
      <button
        disabled={pending}
        className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "…" : "Set"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        Cancel
      </button>
      {state.error && <span className="w-full text-right text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
