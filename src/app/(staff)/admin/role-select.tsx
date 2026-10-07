"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { changeRole, type RoleState } from "./actions";

const ROLE_STYLES: Record<Role, string> = {
  admin: "bg-brand-50 text-brand-700",
  canteen_staff: "bg-emerald-50 text-emerald-700",
  counter_staff: "bg-sky-50 text-sky-700",
  parent: "bg-slate-100 text-slate-700",
};

// Shows the member's role; "Change" opens a dropdown to pick a new one.
export function RoleSelect({ memberId, role }: { memberId: string; role: Role }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<RoleState, FormData>(async (prev, formData) => {
    const result = await changeRole(prev, formData);
    if (result.saved) setEditing(false);
    return result;
  }, {});

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_STYLES[role]}`}>
          {ROLE_LABELS[role]}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <Pencil className="h-3.5 w-3.5" /> Change
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="member_id" value={memberId} />
      <select
        name="role"
        defaultValue={role}
        autoFocus
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
      >
        {/* Staff roles only. To take away staff access, use "Remove from staff". */}
        {Object.entries(ROLE_LABELS)
          .filter(([value]) => value !== "parent")
          .map(([value, label]) => (
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
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100"
      >
        Cancel
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
