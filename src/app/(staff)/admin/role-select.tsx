"use client";

import { useActionState } from "react";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { changeRole, type RoleState } from "./actions";

export function RoleSelect({ memberId, role }: { memberId: string; role: Role }) {
  const [state, action, pending] = useActionState<RoleState, FormData>(changeRole, {});

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="member_id" value={memberId} />
      <select
        name="role"
        defaultValue={role}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
      >
        {Object.entries(ROLE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button
        disabled={pending}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.saved && !pending && <span className="text-xs text-emerald-700">Saved</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
