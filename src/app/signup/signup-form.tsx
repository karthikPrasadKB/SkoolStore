"use client";

import { useActionState, useState } from "react";
import { signup, type FormState } from "@/app/auth/actions";
import { SchoolPicker, type School } from "@/components/school-picker";
import { Alert, Button, Field } from "@/components/ui";

export function SignupForm({ schools }: { schools: School[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, {});
  const [multiple, setMultiple] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  if (state.message) return <Alert kind="success">{state.message}</Alert>;

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Which school?</span>
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          {[
            { value: false, label: "One school" },
            { value: true, label: "More than one school" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                setMultiple(option.value);
                if (!option.value) setSelected((current) => current.slice(0, 1));
              }}
              className={`rounded-lg py-2 transition ${
                multiple === option.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <SchoolPicker
          schools={schools}
          name="school_code"
          multiple={multiple}
          selected={selected}
          onChange={setSelected}
        />
        <span className="mt-1 block text-xs text-slate-500">
          {multiple
            ? "Pick every school your children go to. You can add more later."
            : "Type your school's name to find it."}
        </span>
      </div>

      <Field label="Full name" name="full_name" autoComplete="name" required />
      <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="At least 8 characters."
      />
      <Button type="submit" disabled={pending || selected.length === 0} className="w-full py-3">
        {pending ? "Creating account…" : selected.length === 0 ? "Choose your school first" : "Create account"}
      </Button>
    </form>
  );
}
