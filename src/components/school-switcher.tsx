"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { createSchool, switchSchool, type NewSchoolState } from "@/app/(staff)/school-actions";
import { ROLE_LABELS, type Role } from "@/lib/roles";

export type MySchool = { id: string; name: string; role: Role };

// Shows the school being worked in; staff at several schools can switch, admins can add a school.
export function SchoolSwitcher({
  schools,
  currentId,
  canAdd,
}: {
  schools: MySchool[];
  currentId: string;
  canAdd: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [switching, startSwitch] = useTransition();
  const [state, action, pending] = useActionState<NewSchoolState, FormData>(createSchool, {});
  const current = schools.find((s) => s.id === currentId);
  const canOpen = schools.length > 1 || canAdd;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => canOpen && setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-left ${canOpen ? "hover:bg-slate-100" : "cursor-default"}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">School</span>
          <span className="block truncate font-semibold text-slate-800">
            {switching ? "Switching…" : (current?.name ?? "—")}
          </span>
        </span>
        {canOpen && <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {schools.map((school) => (
            <button
              key={school.id}
              type="button"
              disabled={switching}
              onClick={() => {
                setOpen(false);
                if (school.id !== currentId) startSwitch(async () => void (await switchSchool(school.id)));
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900">{school.name}</span>
                <span className="block text-xs text-slate-500">{ROLE_LABELS[school.role]}</span>
              </span>
              {school.id === currentId && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}

          {canAdd &&
            (adding ? (
              <form action={action} className="space-y-2 border-t border-slate-100 p-3">
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={200}
                  autoFocus
                  placeholder="New school name"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
                />
                {state.error && <p className="text-xs text-red-600">{state.error}</p>}
                <div className="flex gap-1.5">
                  <button
                    disabled={pending}
                    className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {pending ? "Adding…" : "Add school"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-brand-600 hover:bg-brand-50"
              >
                <Plus className="h-4 w-4" /> Add a school
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
