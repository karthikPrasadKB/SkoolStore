"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { Flash } from "@/components/flash";
import { Alert, Button } from "@/components/ui";
import { AdminFields, ExistingToggle, ExistingUsername, SchoolChecks } from "@/components/admin-form-fields";
import { addClientAdmin, createClientAccount, type HqState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function NewClientForm() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<HqState, FormData>(async (prev, formData) => {
    const result = await createClientAccount(prev, formData);
    if (result.done) {
      formRef.current?.reset();
      setOpen(false);
      setNotice(result.done ?? null);
    }
    return result;
  }, {});

  if (!open) {
    return (
      <div className="space-y-3">
        {notice && <Flash message={notice} onClose={() => setNotice(null)} />}
        <Button
          onClick={() => {
            setOpen(true);
            setNotice(null);
          }}
        >
          <Plus className="h-4 w-4" /> Add a client
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <p className="mb-2 font-semibold text-slate-900">Client</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            name="client_name"
            required
            minLength={2}
            maxLength={200}
            placeholder="Client name"
            aria-label="Client name"
            className={inputClass}
          />
          <input
            name="client_email"
            type="email"
            placeholder="Client email (optional)"
            aria-label="Client email (optional)"
            className={inputClass}
          />
          <input
            name="client_phone"
            type="tel"
            maxLength={20}
            placeholder="Client phone (optional)"
            aria-label="Client phone (optional)"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <p className="mb-2 font-semibold text-slate-900">Client&apos;s admin login</p>
        <AdminFields />
        <p className="mt-2 text-xs text-slate-500">
          On their first login they create their schools, then add staff, menus and partners.
        </p>
      </div>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create client"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AddClientAdminForm({
  clientId,
  schools,
}: {
  clientId: string;
  schools: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, action, pending] = useActionState<HqState, FormData>(async (prev, formData) => {
    const result = await addClientAdmin(prev, formData);
    if (result.done) {
      setOpen(false);
      setNotice(result.done ?? null);
    }
    return result;
  }, {});

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={schools.length === 0}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-40"
        >
          <UserPlus className="h-3.5 w-3.5" /> Add admin
        </button>
        <div className="max-w-72">{notice && <Flash message={notice} onClose={() => setNotice(null)} />}</div>
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 w-full space-y-3 rounded-xl bg-slate-50 p-4">
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-sm font-semibold text-slate-900">Add an admin (e.g. a partner)</p>
      <SchoolChecks schools={schools} />
      <ExistingToggle existing={existing} setExisting={setExisting} />
      {existing ? <ExistingUsername /> : <AdminFields />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="py-2 text-sm">
          {pending ? "Adding…" : "Add admin"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="py-2 text-sm">
          Cancel
        </Button>
      </div>
    </form>
  );
}
