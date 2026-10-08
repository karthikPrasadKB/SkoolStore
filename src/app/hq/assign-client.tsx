"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui";
import { assignSchoolToClient, type HqState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-500";

// For schools created before clients existed: put them under an existing or new client.
export function AssignClient({ schoolId, clients }: { schoolId: string; clients: { id: string; name: string }[] }) {
  const [choice, setChoice] = useState(clients[0]?.id ?? "__new__");
  const [state, action, pending] = useActionState<HqState, FormData>(assignSchoolToClient, {});

  return (
    <form action={action} className="w-full space-y-2 sm:w-72">
      <input type="hidden" name="school_id" value={schoolId} />
      <div className="flex gap-2">
        <select
          name="client_id"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          aria-label="Client"
          className={inputClass}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__new__">+ New client…</option>
        </select>
        <button
          disabled={pending}
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "…" : "Assign"}
        </button>
      </div>
      {choice === "__new__" && (
        <div className="space-y-1.5">
          <input
            name="client_name"
            required
            minLength={2}
            maxLength={200}
            placeholder="Client name"
            className={inputClass}
          />
          <input name="client_email" type="email" required placeholder="Client email" className={inputClass} />
          <input
            name="client_phone"
            type="tel"
            required
            maxLength={20}
            placeholder="Client phone"
            className={inputClass}
          />
        </div>
      )}
      {state.error && <Alert kind="error">{state.error}</Alert>}
    </form>
  );
}
