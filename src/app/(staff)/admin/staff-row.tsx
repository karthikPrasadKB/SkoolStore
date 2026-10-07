"use client";

import { useActionState, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { deleteStaff, updateStaff, type EditStaffState } from "./actions";
import { ResetPassword } from "./reset-password";
import { RoleSelect } from "./role-select";

export type StaffMember = {
  id: string;
  full_name: string;
  username: string | null;
  contact_email: string | null;
  phone: string | null;
  role: Role;
};

const cellInput =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15";

// One staff member. "Edit" turns their details into input boxes.
export function StaffRow({ member, isMe }: { member: StaffMember; isMe: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<EditStaffState, FormData>(async (prev, formData) => {
    const result = await updateStaff(prev, formData);
    if (result.saved) setEditing(false);
    return result;
  }, {});
  const formId = `edit-staff-${member.id}`;

  if (editing) {
    return (
      <tr className="bg-brand-50/40 align-top">
        <td className="px-6 py-3">
          {/* Inputs join this form through form={formId}, which keeps the table valid. */}
          <form id={formId} action={action}>
            <input type="hidden" name="member_id" value={member.id} />
          </form>
          <input
            form={formId}
            name="full_name"
            defaultValue={member.full_name}
            required
            maxLength={100}
            autoFocus
            aria-label="Name"
            className={cellInput}
          />
          <input
            form={formId}
            name="email"
            type="email"
            defaultValue={member.contact_email ?? ""}
            placeholder="Email (optional)"
            aria-label="Email"
            className={`${cellInput} mt-1.5`}
          />
          {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
        </td>
        <td className="px-6 py-3">
          {member.username ? (
            <input
              form={formId}
              name="username"
              defaultValue={member.username}
              required
              pattern="[a-zA-Z0-9._]{3,30}"
              title="3–30 letters, numbers, dots or underscores"
              autoCapitalize="none"
              spellCheck={false}
              aria-label="Username"
              className={`${cellInput} w-36 font-mono lowercase`}
            />
          ) : (
            <span className="text-slate-500">email login</span>
          )}
        </td>
        <td className="px-6 py-3">
          <input
            form={formId}
            name="phone"
            type="tel"
            defaultValue={member.phone ?? ""}
            required
            maxLength={20}
            aria-label="Phone"
            className={`${cellInput} w-36`}
          />
        </td>
        <td className="px-6 py-3 text-slate-500">{ROLE_LABELS[member.role]}</td>
        <td className="px-6 py-3">
          {/* Separate keys stop React reusing the Edit button as Save (which made Edit submit straight away). */}
          <div key="editing" className="flex justify-end gap-1">
            <button
              type="submit"
              form={formId}
              disabled={pending}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-6 py-3">
        <p className="font-medium text-slate-900">{member.full_name || "—"}</p>
        {member.contact_email && <p className="text-xs text-slate-400">{member.contact_email}</p>}
      </td>
      <td className="px-6 py-3 font-mono text-slate-700">{member.username ?? "email login"}</td>
      <td className="px-6 py-3 text-slate-600">{member.phone ?? "—"}</td>
      <td className="px-6 py-3">
        {isMe ? (
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
            {ROLE_LABELS[member.role]} (you)
          </span>
        ) : (
          <RoleSelect memberId={member.id} role={member.role} />
        )}
      </td>
      <td className="px-6 py-3">
        {!isMe && (
          <div key="viewing" className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title={`Edit ${member.full_name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            {member.username && <ResetPassword memberId={member.id} name={member.full_name} />}
            <form action={deleteStaff}>
              <input type="hidden" name="member_id" value={member.id} />
              <ConfirmButton
                message={
                  member.username
                    ? `Delete ${member.full_name}'s account? They won't be able to log in any more. This can't be undone.`
                    : `Remove ${member.full_name} from staff? Their account stays (it may be a parent account), but they lose staff access.`
                }
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title={member.username ? "Delete staff account" : "Remove from staff"}
              >
                <Trash2 className="h-4 w-4" />
              </ConfirmButton>
            </form>
          </div>
        )}
      </td>
    </tr>
  );
}
