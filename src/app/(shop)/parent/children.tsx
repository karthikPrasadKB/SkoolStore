"use client";

import { useActionState, useRef, useState } from "react";
import { IdCard, LifeBuoy, Pencil, Plus, School, Wallet, X } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { InfoTip } from "@/components/info-tip";
import { SchoolPicker, type School as SchoolOption } from "@/components/school-picker";
import { addChild, removeChild, saveChildSettings, type ChildState } from "./actions";
import { ContactSchoolDialog, type ContactPrefill } from "./contact-school";
import { IdCardField } from "./id-card-field";

export type Child = {
  id: string;
  full_name: string;
  class_name: string;
  code: string;
  id_card_number: string | null;
  wallet_allowed: boolean;
  wallet_daily_limit: number | null;
  school_id: string;
  school: { name: string; join_code: string; use_canteen_codes: boolean } | null;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-accent-400 focus:ring-4 focus:ring-accent-400/15";

export function Children({
  students,
  homeSchool,
  linkedSchools,
  allSchools,
  phone,
  email,
}: {
  students: Child[];
  homeSchool: string;
  linkedSchools: SchoolOption[];
  allSchools: SchoolOption[];
  phone: string;
  email: string;
}) {
  const [contact, setContact] = useState<ContactPrefill | null>(null);
  const [adding, setAdding] = useState(students.length === 0);
  const [otherSchool, setOtherSchool] = useState(false);
  const [schoolChoice, setSchoolChoice] = useState(linkedSchools[0]?.join_code ?? "");
  const [pickedOther, setPickedOther] = useState<string[]>([]);
  const hasSeveralSchools = linkedSchools.length > 1;
  const addingSchoolCode =
    otherSchool || schoolChoice === "__other__"
      ? pickedOther[0]
      : hasSeveralSchools
        ? schoolChoice
        : linkedSchools[0]?.join_code;
  const addingSchool = allSchools.find((s) => s.join_code === addingSchoolCode);
  // Schools offered in the contact form: the parent's own, plus the one they're adding a child to.
  const contactSchools =
    addingSchool && !linkedSchools.some((s) => s.id === addingSchool.id)
      ? [...linkedSchools, addingSchool]
      : linkedSchools;
  // "Another school" is open but nothing has been picked yet.
  const needsSchool = (otherSchool || schoolChoice === "__other__") && pickedOther.length === 0;
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ChildState, FormData>(async (prev, formData) => {
    const result = await addChild(prev, formData);
    if (result.saved) {
      formRef.current?.reset();
      setAdding(false);
      setOtherSchool(false);
      setPickedOther([]);
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
          <ChildCard
            key={child.id}
            child={child}
            homeSchool={homeSchool}
            showSchool={hasSeveralSchools}
            linkedSchools={linkedSchools}
            allSchools={allSchools}
            onContact={(idCardNumber) => setContact({ schoolId: child.school_id, idCardNumber })}
          />
        ))}

        {adding && (
          <form
            ref={formRef}
            action={action}
            className="space-y-3 rounded-2xl border-2 border-dashed border-slate-200 p-5"
          >
            <p className="font-semibold text-slate-900">Add a child</p>
            <div>
              <div className="mb-1 flex items-center gap-1">
                <label htmlFor="new-child-name" className="text-sm font-semibold text-slate-700">
                  Full name, exactly as on the ID card
                </label>
                <InfoTip text="Write the name exactly as it appears on your child's school ID card. Canteen staff check it against the card before handing over food and items." />
              </div>
              <input
                id="new-child-name"
                name="full_name"
                required
                maxLength={100}
                placeholder="e.g. Aarav Sharma"
                className={inputClass}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1">
                <label htmlFor="new-child-class" className="text-sm font-semibold text-slate-700">
                  Class and section, as on the ID card
                </label>
                <InfoTip text="Use the same class and section as the ID card (e.g. 5-B). Orders are sorted and delivered by class, so a wrong class can delay your child's food." />
              </div>
              <input
                id="new-child-class"
                name="class_name"
                required
                maxLength={30}
                placeholder="e.g. 5-B"
                className={inputClass}
              />
            </div>
            <IdCardField id="new-child-id" inputClass={inputClass} />
            {hasSeveralSchools && (
              <select
                name={schoolChoice === "__other__" ? undefined : "school_code"}
                value={schoolChoice}
                onChange={(e) => setSchoolChoice(e.target.value)}
                className={inputClass}
                aria-label="School"
              >
                {linkedSchools.map((school) => (
                  <option key={school.id} value={school.join_code}>
                    {school.name}
                  </option>
                ))}
                <option value="__other__">Another school…</option>
              </select>
            )}
            {(otherSchool || schoolChoice === "__other__") && (
              <SchoolPicker
                schools={allSchools}
                name="school_code"
                selected={pickedOther}
                onChange={setPickedOther}
                placeholder="Search for their school"
              />
            )}
            {!hasSeveralSchools && !otherSchool && (
              <button
                type="button"
                onClick={() => setOtherSchool(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
              >
                <School className="h-4 w-4" /> Goes to a different school than {homeSchool}?
              </button>
            )}
            {state.error && <p className="text-sm text-red-600">{state.error}</p>}
            {state.duplicateId && (
              <ContactAdminButton
                onClick={() => setContact({ schoolId: addingSchool?.id, idCardNumber: state.duplicateId })}
              />
            )}
            <div className="flex gap-2">
              <button
                disabled={pending || needsSchool}
                className="flex-1 rounded-xl bg-accent-500 py-2.5 font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
              >
                {pending ? "Adding…" : needsSchool ? "Choose their school" : "Add child"}
              </button>
              {students.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setOtherSchool(false);
                  }}
                  className="rounded-xl px-4 py-2.5 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <button
        onClick={() => setContact({ schoolId: linkedSchools[0]?.id })}
        className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <LifeBuoy className="h-4 w-4" /> Problem with an ID number? Contact the school
      </button>

      {contact && (
        <ContactSchoolDialog
          schools={contactSchools}
          prefill={contact}
          phone={phone}
          email={email}
          onClose={() => setContact(null)}
        />
      )}
    </section>
  );
}

function ContactAdminButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
    >
      <LifeBuoy className="h-3.5 w-3.5" /> Contact the school admin
    </button>
  );
}

function ChildCard({
  child,
  homeSchool,
  showSchool,
  linkedSchools,
  allSchools,
  onContact,
}: {
  child: Child;
  homeSchool: string;
  showSchool: boolean;
  linkedSchools: SchoolOption[];
  allSchools: SchoolOption[];
  onContact: (idCardNumber?: string) => void;
}) {
  const currentCode = child.school?.join_code ?? "";
  // The child's school is always offered, plus the parent's other schools, plus "Another school…".
  const schoolOptions = linkedSchools.some((s) => s.join_code === currentCode)
    ? linkedSchools
    : [...linkedSchools, ...allSchools.filter((s) => s.join_code === currentCode)];
  const [schoolChoice, setSchoolChoice] = useState(currentCode);
  const [pickedOther, setPickedOther] = useState<string[]>([]);
  const [allowed, setAllowed] = useState(child.wallet_allowed);
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<ChildState, FormData>(async (prev, formData) => {
    const result = await saveChildSettings(prev, formData);
    if (result.saved) setEditing(false);
    return result;
  }, {});
  const limitText =
    child.wallet_daily_limit === null
      ? "no daily limit"
      : `up to ₹${child.wallet_daily_limit.toLocaleString("en-IN")} a day`;
  const schoolName = child.school?.name ?? homeSchool;

  return (
    <div className="relative rounded-2xl border border-slate-200 p-5">
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
      <p className="text-sm text-slate-500">
        {child.class_name || "Class not set"}
        {(showSchool || schoolName !== homeSchool) && ` · ${schoolName}`}
      </p>
      {child.id_card_number ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <IdCard className="h-5 w-5 shrink-0 text-slate-500" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">ID card number</p>
            <p className="font-mono text-lg font-bold text-slate-900">{child.id_card_number}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Add your child&apos;s ID card number (tap Edit) so the counter can find them.
        </p>
      )}

      {/* Optional, only at schools that use canteen codes */}
      {child.school?.use_canteen_codes && (
        <>
          <div className="mt-3 rounded-xl bg-accent-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">Canteen code</p>
            <p className="font-mono text-3xl font-extrabold tracking-[0.25em] text-slate-900">{child.code}</p>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Your child can say this code instead of showing their ID card. Keep it private, like a PIN.
          </p>
        </>
      )}

      {/* Wallet rules for this child: a summary, or the form while editing */}
      {!editing ? (
        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
          <Wallet className={`h-5 w-5 shrink-0 ${child.wallet_allowed ? "text-emerald-600" : "text-slate-400"}`} />
          <p className="flex-1 text-sm text-slate-700">
            Wallet at the counter:{" "}
            {child.wallet_allowed ? (
              <>
                <span className="font-semibold text-emerald-700">Allowed</span> · {limitText}
              </>
            ) : (
              <span className="font-semibold text-slate-500">Not allowed</span>
            )}
          </p>
          <button
            onClick={() => {
              setAllowed(child.wallet_allowed);
              setEditing(true);
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
      ) : (
        <form action={action} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="id" value={child.id} />
          <div>
            <label htmlFor={`child-school-${child.id}`} className="mb-1 block text-sm font-semibold text-slate-700">
              School
            </label>
            <input type="hidden" name="current_school_code" value={currentCode} />
            <select
              id={`child-school-${child.id}`}
              name={schoolChoice === "__other__" ? undefined : "school_code"}
              value={schoolChoice}
              onChange={(e) => setSchoolChoice(e.target.value)}
              className={inputClass}
            >
              {schoolOptions.map((school) => (
                <option key={school.id} value={school.join_code}>
                  {school.name}
                </option>
              ))}
              <option value="__other__">Another school…</option>
            </select>
            {schoolChoice === "__other__" && (
              <div className="mt-2">
                <SchoolPicker
                  schools={allSchools}
                  name="school_code"
                  selected={pickedOther}
                  onChange={setPickedOther}
                  placeholder="Search for their new school"
                />
              </div>
            )}
            {schoolChoice !== currentCode && (
              <p className="mt-1 text-xs text-amber-700">
                Changing school: upcoming pre-orders must be cancelled first. Wallet money stays with the old school.
              </p>
            )}
          </div>
          <IdCardField id={`child-id-${child.id}`} defaultValue={child.id_card_number ?? ""} inputClass={inputClass} />
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-800">Can pay with wallet at the counter</span>
            <input
              type="checkbox"
              name="wallet_allowed"
              checked={allowed}
              onChange={(e) => setAllowed(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${allowed ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${allowed ? "left-[22px]" : "left-0.5"}`}
              />
            </span>
          </label>
          {allowed && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Daily limit (₹)</span>
              <input
                name="daily_limit"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                defaultValue={child.wallet_daily_limit ?? ""}
                placeholder="No limit"
                className={inputClass}
              />
            </label>
          )}
          {!allowed && <input type="hidden" name="daily_limit" value={child.wallet_daily_limit ?? ""} />}
          <div className="flex items-center gap-3">
            <button
              disabled={pending || (schoolChoice === "__other__" && pickedOther.length === 0)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            {state.error && <span className="text-xs text-red-600">{state.error}</span>}
          </div>
          {state.duplicateId && (
            <div>
              <ContactAdminButton onClick={() => onContact(state.duplicateId)} />
            </div>
          )}
        </form>
      )}
    </div>
  );
}
