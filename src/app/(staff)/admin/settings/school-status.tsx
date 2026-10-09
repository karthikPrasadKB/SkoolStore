"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/modal";
import { Alert, Button, Card } from "@/components/ui";
import { formatINR } from "@/lib/menu";
import {
  deleteSchool,
  previewSchoolDeletion,
  setSchoolDisabled,
  type DeleteSchoolState,
  type SchoolDeletionPreview,
} from "./actions";

// Settings section: switch the school on/off, or delete it. Each has a warning pop-up.
export function SchoolStatus({ schoolName, disabled }: { schoolName: string; disabled: boolean }) {
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [toggling, startToggle] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SchoolDeletionPreview | null>(null);
  const [loading, startLoading] = useTransition();
  const [phrase, setPhrase] = useState("");
  const [state, action, deleting] = useActionState<DeleteSchoolState, FormData>(deleteSchool, {});
  const required = `Delete ${schoolName.trim()}`;

  function toggle(value: boolean) {
    setToggleError(null);
    startToggle(async () => {
      const result = await setSchoolDisabled(value);
      if (result.error) setToggleError(result.error);
      setConfirmDisable(false);
    });
  }

  function openDelete() {
    setPhrase("");
    startLoading(async () => {
      const result = await previewSchoolDeletion();
      if ("error" in result) setToggleError(result.error);
      else setPreview(result);
    });
  }

  return (
    <Card>
      <h2 className="font-semibold text-slate-900">School status</h2>
      <p className="mt-0.5 text-sm text-slate-500">Pause this school, or delete it for good.</p>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
        <div>
          <p className="font-semibold text-slate-900">{disabled ? "School is disabled" : "School is active"}</p>
          <p className="text-sm text-slate-500">
            {disabled
              ? "Parents can't see it and staff can't use it. Only admins can open it."
              : "Parents can order and staff can use the counter."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!disabled}
          aria-label={disabled ? "Enable school" : "Disable school"}
          disabled={toggling}
          onClick={() => (disabled ? toggle(false) : setConfirmDisable(true))}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${disabled ? "bg-slate-300" : "bg-emerald-500"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${disabled ? "left-0.5" : "left-[22px]"}`}
          />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-red-200 px-4 py-3">
        <div>
          <p className="font-semibold text-red-700">Delete school</p>
          <p className="text-sm text-slate-500">Removes the school and everything in it. This can&apos;t be undone.</p>
        </div>
        <button
          type="button"
          onClick={openDelete}
          disabled={loading}
          title="Delete school"
          aria-label="Delete school"
          className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
      {toggleError && (
        <div className="mt-3">
          <Alert kind="error">{toggleError}</Alert>
        </div>
      )}

      {confirmDisable && (
        <Modal title={`Disable ${schoolName}?`} tone="warning" onClose={() => setConfirmDisable(false)}>
          <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" />
            <ul className="space-y-1">
              <li>Parents won&apos;t see this school, and no new orders can be placed.</li>
              <li>Counter and store staff won&apos;t be able to use it.</li>
              <li>You and other admins can still open it to turn it back on.</li>
              <li>Nothing is deleted.</li>
            </ul>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDisable(false)}>
              Cancel
            </Button>
            <button
              onClick={() => toggle(true)}
              disabled={toggling}
              className="rounded-xl bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {toggling ? "Disabling…" : "Disable school"}
            </button>
          </div>
        </Modal>
      )}

      {preview && (
        <Modal title={`Delete ${schoolName}`} tone="danger" onClose={() => setPreview(null)}>
          <form action={action} className="space-y-4 text-sm">
            <div className="rounded-xl bg-red-50 p-4 text-red-900">
              <p className="flex items-center gap-2 font-bold">
                <TriangleAlert className="h-5 w-5 text-red-600" /> This permanently deletes:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5">
                <li>The school&apos;s menu, settings and breaks</li>
                <li>{preview.orders} orders and bills (including tax invoices)</li>
                <li>{preview.students} students</li>
                <li>
                  {preview.staff} staff membership{preview.staff === 1 ? "" : "s"}. Staff with no other school lose
                  their login
                </li>
                {Number(preview.wallet_balance) > 0 && (
                  <li className="font-bold">
                    {formatINR(Number(preview.wallet_balance))} of parents&apos; wallet money. Refund it first.
                  </li>
                )}
                {preview.removes_you && <li className="font-bold">Your own login, as this is your only school</li>}
              </ul>
              {preview.last_school && !preview.removes_you && (
                <p className="mt-2">This is your only school. You&apos;ll be asked to create a new one afterwards.</p>
              )}
              <p className="mt-2">
                To keep its records, use the <strong>Disable</strong> switch instead.
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-800">
                To confirm, type <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{required}</span>
              </span>
              <input
                name="confirm_phrase"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                autoComplete="off"
                autoFocus
                spellCheck={false}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
              />
            </label>
            {state.error && <Alert kind="error">{state.error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <button
                disabled={deleting || phrase.trim() !== required}
                className="rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
