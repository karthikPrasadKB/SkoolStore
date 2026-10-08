"use client";

import { useActionState } from "react";
import { School } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { createFirstSchool, type FirstSchoolState } from "./actions";

export function FirstSchoolForm() {
  const [state, action, pending] = useActionState<FirstSchoolState, FormData>(createFirstSchool, {});
  return (
    <form action={action} className="space-y-3">
      <div className="relative">
        <School className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          name="name"
          required
          minLength={2}
          maxLength={200}
          autoFocus
          placeholder="School name and area, e.g. William Richards School - KGF"
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
        />
      </div>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full py-3">
        {pending ? "Creating…" : "Create school"}
      </Button>
    </form>
  );
}
