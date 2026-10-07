"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { addChild, removeChild, type ChildState } from "./actions";

export type Child = { id: string; full_name: string; class_name: string; code: string };

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-accent-400 focus:ring-4 focus:ring-accent-400/15";

export function Children({ students }: { students: Child[] }) {
  const [adding, setAdding] = useState(students.length === 0);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ChildState, FormData>(async (prev, formData) => {
    const result = await addChild(prev, formData);
    if (result.saved) {
      formRef.current?.reset();
      setAdding(false);
    }
    return result;
  }, {});

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">My children</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-accent-600 hover:bg-accent-50"
          >
            <Plus className="h-4 w-4" /> Add child
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {students.map((child) => (
          <div key={child.id} className="relative rounded-2xl border border-slate-200 p-5">
            <form action={removeChild} className="absolute right-3 top-3">
              <input type="hidden" name="id" value={child.id} />
              <ConfirmButton
                message={`Remove ${child.full_name}? Their past orders will be kept.`}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                title="Remove child"
              >
                <X className="h-4 w-4" />
              </ConfirmButton>
            </form>
            <p className="font-bold text-slate-900">{child.full_name}</p>
            <p className="text-sm text-slate-500">{child.class_name || "Class not set"}</p>
            <div className="mt-4 rounded-xl bg-accent-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">Canteen code</p>
              <p className="font-mono text-3xl font-extrabold tracking-[0.25em] text-slate-900">{child.code}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Your child says this code at the counter. Keep it private, like a PIN.
            </p>
          </div>
        ))}

        {adding && (
          <form ref={formRef} action={action} className="space-y-3 rounded-2xl border-2 border-dashed border-slate-200 p-5">
            <p className="font-semibold text-slate-900">Add a child</p>
            <input name="full_name" required maxLength={100} placeholder="Child's full name" className={inputClass} />
            <input name="class_name" maxLength={30} placeholder="Class, e.g. 5-B" className={inputClass} />
            {state.error && <p className="text-sm text-red-600">{state.error}</p>}
            <div className="flex gap-2">
              <button
                disabled={pending}
                className="flex-1 rounded-xl bg-accent-500 py-2.5 font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
              >
                {pending ? "Adding…" : "Add child"}
              </button>
              {students.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="rounded-xl px-4 py-2.5 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
