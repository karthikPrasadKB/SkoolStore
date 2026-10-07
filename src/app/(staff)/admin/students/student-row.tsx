"use client";

import { useActionState, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteStudent, updateStudent, type StudentState } from "./actions";

export type StudentRowData = {
  id: string;
  full_name: string;
  class_name: string;
  code: string;
  id_card_number: string | null;
  parent: { full_name: string; phone: string | null } | null;
};

const cellInput =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15";

// One student in the table. "Edit" turns the name, class and ID number into input boxes.
export function StudentRow({ student, showCode }: { student: StudentRowData; showCode: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<StudentState, FormData>(async (prev, formData) => {
    const result = await updateStudent(prev, formData);
    if (result.saved) setEditing(false);
    return result;
  }, {});
  const formId = `edit-student-${student.id}`;

  const parentCell = (
    <td className="px-5 py-3 text-slate-600">
      {student.parent ? (
        <>
          {student.parent.full_name}
          {student.parent.phone && <span className="block text-xs text-slate-400">{student.parent.phone}</span>}
        </>
      ) : (
        <span className="text-slate-400">Not linked</span>
      )}
    </td>
  );
  const codeCell = showCode && (
    <td className="px-5 py-3 font-mono font-semibold tracking-widest">{student.code}</td>
  );

  if (editing) {
    return (
      <tr className="bg-brand-50/40 align-top">
        <td className="px-5 py-3">
          {/* The form wraps nothing: inputs join it through form={formId}, which keeps the table valid. */}
          <form id={formId} action={action}>
            <input type="hidden" name="id" value={student.id} />
          </form>
          <input
            form={formId}
            name="full_name"
            defaultValue={student.full_name}
            required
            maxLength={100}
            autoFocus
            aria-label="Name"
            className={cellInput}
          />
          {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
        </td>
        <td className="px-5 py-3">
          <input
            form={formId}
            name="class_name"
            defaultValue={student.class_name}
            maxLength={30}
            aria-label="Class"
            className={`${cellInput} w-24`}
          />
        </td>
        <td className="px-5 py-3">
          <input
            form={formId}
            name="id_card_number"
            defaultValue={student.id_card_number ?? ""}
            maxLength={30}
            placeholder="ID number"
            aria-label="ID card number"
            className={`${cellInput} w-36 font-mono uppercase`}
          />
        </td>
        {codeCell}
        {parentCell}
        <td className="px-5 py-3">
          {/* Separate keys stop React reusing the Edit button as Save (which made Edit submit straight away). */}
          <div key="editing" className="flex justify-end gap-1">
            <button
              type="submit"
              form={formId}
              disabled={pending}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-5 py-3 font-medium text-slate-900">{student.full_name}</td>
      <td className="px-5 py-3 text-slate-600">{student.class_name || "—"}</td>
      <td className="px-5 py-3 font-mono font-semibold">
        {student.id_card_number ?? <span className="font-sans font-normal text-amber-600">Missing</span>}
      </td>
      {codeCell}
      {parentCell}
      <td className="px-5 py-3">
        <div key="viewing" className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Edit student"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <form action={deleteStudent}>
            <input type="hidden" name="id" value={student.id} />
            <ConfirmButton
              message={`Remove ${student.full_name}? Their past orders will be kept.`}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title="Remove student"
            >
              <Trash2 className="h-4 w-4" />
            </ConfirmButton>
          </form>
        </div>
      </td>
    </tr>
  );
}
