"use client";

import { useActionState } from "react";
import { CircleCheck, X } from "lucide-react";
import type { School } from "@/components/school-picker";
import { sendSupportRequest, type RequestState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-accent-400 focus:ring-4 focus:ring-accent-400/15";

export type ContactPrefill = { schoolId?: string; idCardNumber?: string };

// Pop-up form for writing to the school admin.
export function ContactSchoolDialog({
  schools,
  prefill,
  phone,
  email,
  onClose,
}: {
  schools: School[];
  prefill: ContactPrefill;
  phone: string;
  email: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<RequestState, FormData>(sendSupportRequest, {});
  const defaultSchool = schools.find((s) => s.id === prefill.schoolId) ?? schools[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Contact the school admin</h2>
            <p className="text-sm text-slate-500">They&apos;ll get back to you by phone or email.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {state.sent ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CircleCheck className="h-12 w-12 text-emerald-500" />
            <p className="mt-3 font-semibold text-slate-900">Message sent</p>
            <p className="mt-1 text-sm text-slate-500">You can see the school&apos;s reply under &ldquo;Messages to the school&rdquo;.</p>
            <button onClick={onClose} className="mt-6 rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white hover:bg-slate-700">
              Done
            </button>
          </div>
        ) : (
          <form action={action} className="mt-5 space-y-3">
            {schools.length > 1 ? (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">School</span>
                <select name="school_id" defaultValue={defaultSchool?.id} className={inputClass}>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="school_id" value={defaultSchool?.id ?? ""} />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Your phone</span>
                <input name="phone" type="tel" required defaultValue={phone} maxLength={20} className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Your email</span>
                <input name="email" type="email" required defaultValue={email} maxLength={320} className={inputClass} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">ID card number or code (if it&apos;s about one)</span>
              <input
                name="id_card_number"
                defaultValue={prefill.idCardNumber ?? ""}
                maxLength={30}
                className={`${inputClass} font-mono uppercase`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Describe the problem</span>
              <textarea
                name="message"
                required
                minLength={5}
                maxLength={2000}
                rows={4}
                defaultValue={
                  prefill.idCardNumber
                    ? `My child's ID card number ${prefill.idCardNumber} is already being used by another student. Please help.`
                    : ""
                }
                className={inputClass}
              />
            </label>
            {state.error && <p className="text-sm text-red-600">{state.error}</p>}
            <button
              disabled={pending}
              className="w-full rounded-xl bg-accent-500 py-3 font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send to school admin"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
