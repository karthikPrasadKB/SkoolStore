"use client";

import { useActionState, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { createCategory, renameCategory, type ActionState } from "../actions";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function AddCategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await createCategory(prev, formData);
    if (result.saved) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={action}>
      <div className="flex gap-2">
        <input name="name" required maxLength={60} placeholder="e.g. Snacks, Meals, Drinks" className={inputClass} />
        <Button type="submit" disabled={pending} className="shrink-0">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function RenameCategoryForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(renameCategory, {});

  return (
    <form action={action} className="flex-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center gap-2">
        <input
          name="name"
          defaultValue={name}
          required
          maxLength={60}
          aria-label="Category name"
          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-semibold text-slate-900 outline-none hover:border-slate-200 focus:border-brand-500 focus:bg-white"
        />
        <button
          disabled={pending}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Rename"}
        </button>
      </div>
      {state.error && <p className="px-2 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
