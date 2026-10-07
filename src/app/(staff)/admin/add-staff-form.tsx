"use client";

import { useActionState, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { addStaff, type StaffState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function AddStaffForm({ ready }: { ready: boolean }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<StaffState, FormData>(async (prev, formData) => {
    const result = await addStaff(prev, formData);
    if (result.added) {
      formRef.current?.reset();
      setOpen(false);
    }
    return result;
  }, {});

  if (!open) {
    return (
      <div className="space-y-3">
        {state.added && <Alert kind="success">{state.added}</Alert>}
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" /> Add staff
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      {!ready && (
        <Alert kind="error">
          Adding staff needs the Supabase secret key in .env.local (SUPABASE_SECRET_KEY). See the setup steps in the README.
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="full_name" required maxLength={100} placeholder="Full name" className={inputClass} />
        <select name="role" defaultValue="counter_staff" className={inputClass} aria-label="Role">
          <option value="counter_staff">Counter staff</option>
          <option value="canteen_staff">Canteen staff</option>
          <option value="admin">School admin</option>
        </select>
        <input
          name="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9._]{3,30}"
          title="3–30 letters, numbers, dots or underscores"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          placeholder="Username for login, e.g. ramesh.k"
          className={`${inputClass} lowercase`}
        />
        <input name="phone" type="tel" required maxLength={20} placeholder="Phone" className={inputClass} />
        <input name="email" type="email" placeholder="Email (optional)" className={inputClass} />
        <input
          name="password"
          type="text"
          required
          minLength={8}
          autoComplete="off"
          placeholder="Temporary password (8+ characters)"
          className={inputClass}
        />
      </div>
      <p className="text-xs text-slate-500">
        Share the username and temporary password with them. They log in by typing the username in the login page&apos;s
        first box.
      </p>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !ready}>
          {pending ? "Creating account…" : "Create staff account"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
