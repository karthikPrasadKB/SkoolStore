"use client";

import { useActionState, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { addStudent, type StudentState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function AddStudentForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<StudentState, FormData>(async (prev, formData) => {
    const result = await addStudent(prev, formData);
    if (result.saved) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={action}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="full_name" required maxLength={100} placeholder="Student's full name" className={inputClass} />
        <input name="class_name" maxLength={30} placeholder="Class, e.g. 5-B" className={`${inputClass} sm:w-40`} />
        <Button type="submit" disabled={pending} className="shrink-0">
          <Plus className="h-4 w-4" /> Add student
        </Button>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
