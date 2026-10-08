"use client";

import { useActionState, useState } from "react";
import { Handshake } from "lucide-react";
import { AdminFields, ExistingToggle, ExistingUsername, SchoolChecks } from "@/components/admin-form-fields";
import { Flash } from "@/components/flash";
import { Alert, Button, Card } from "@/components/ui";
import { addPartner, type PartnerState } from "./actions";

export type Partner = { name: string; schools: string[] };

// The admins of this client's schools, and a form to add a partner.
export function Partners({ partners, mySchools }: { partners: Partner[]; mySchools: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, action, pending] = useActionState<PartnerState, FormData>(async (prev, formData) => {
    const result = await addPartner(prev, formData);
    if (result.done) {
      setOpen(false);
      setNotice(result.done ?? null);
    }
    return result;
  }, {});

  return (
    <Card className="mt-6">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        <Handshake className="h-5 w-5 text-brand-600" /> Partners{" "}
      </h2>
      <p className="mt-0.5 text-sm text-slate-500">Admins who manage your schools with you.</p>

      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {partners.map((p) => (
          <li key={p.name} className="flex flex-wrap justify-between gap-2 py-2">
            <span className="font-medium text-slate-900">{p.name}</span>
            <span className="text-slate-500">
              {p.schools.length === mySchools.length ? "All your schools" : p.schools.join(", ")}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3">{notice && <Flash message={notice} onClose={() => setNotice(null)} />}</div>

      {open ? (
        <form action={action} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
          <SchoolChecks schools={mySchools} />
          <ExistingToggle existing={existing} setExisting={setExisting} />
          {existing ? <ExistingUsername /> : <AdminFields />}
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add partner"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
          <Handshake className="h-4 w-4" /> Add partner
        </Button>
      )}
    </Card>
  );
}
