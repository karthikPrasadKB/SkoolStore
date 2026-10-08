"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown, LoaderCircle, Plus } from "lucide-react";
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
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the list when clicking or tapping anywhere outside it, or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const [switching, startSwitch] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const [state, action, pending] = useActionState<NewSchoolState, FormData>(createSchool, {});
  const current = schools.find((s) => s.id === currentId);
  const canOpen = schools.length > 1 || canAdd;

  return (
    <div ref={rootRef} className="relative">
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
                if (school.id !== currentId) {
                  setTarget(school.name);
                  startSwitch(async () => void (await switchSchool(school.id)));
                }
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
                  placeholder="Name and area, e.g. Greenwood - KGF"
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
      {/* Block the page while switching, so nothing is done in the old school by mistake. */}
      {switching && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm"
        >
          <LoaderCircle className="h-10 w-10 animate-spin text-brand-600" />
          <p className="text-lg font-semibold text-slate-900">Switching to {target ?? "school"}…</p>
        </div>
      )}
    </div>
  );
}
