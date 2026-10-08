"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/modal";
import { Alert, Button } from "@/components/ui";
import { formatINR } from "@/lib/menu";
import { deleteClient, previewClientDeletion, setClientDisabled, type DeletionPreview, type HqState } from "./actions";

// Active/Disabled toggle and the delete bin for one client, each with a warning pop-up.
export function ClientControls({
  clientId,
  clientName,
  disabled,
}: {
  clientId: string;
  clientName: string;
  disabled: boolean;
}) {
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [toggling, startToggle] = useTransition();
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [phrase, setPhrase] = useState("");
  const [state, action, deleting] = useActionState<HqState, FormData>(deleteClient, {});
  const required = `Delete ${clientName.trim()}`;

  function setDisabled(value: boolean) {
    const form = new FormData();
    form.set("client_id", clientId);
    form.set("disabled", value ? "1" : "0");
    startToggle(async () => {
      await setClientDisabled(form);
      setConfirmDisable(false);
    });
  }

  function openDelete() {
    setLoadError(null);
    setPhrase("");
    startLoading(async () => {
      const result = await previewClientDeletion(clientId);
      if ("error" in result) setLoadError(result.error);
      else setPreview(result);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {/* Active / Disabled toggle */}
      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <span className={disabled ? "text-red-600" : "text-emerald-700"}>{disabled ? "Disabled" : "Active"}</span>
        <button
          type="button"
          role="switch"
          aria-checked={!disabled}
          aria-label={disabled ? `Enable ${clientName}` : `Disable ${clientName}`}
          disabled={toggling}
          onClick={() => (disabled ? setDisabled(false) : setConfirmDisable(true))}
          className={`relative h-6 w-11 rounded-full transition disabled:opacity-60 ${disabled ? "bg-slate-300" : "bg-emerald-500"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${disabled ? "left-0.5" : "left-[22px]"}`}
          />
        </button>
      </label>

      {/* Delete */}
      <button
        type="button"
        onClick={openDelete}
        disabled={loading}
        title={`Delete ${clientName}`}
        aria-label={`Delete ${clientName}`}
        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
      >
        <Trash2 className="h-5 w-5" />
      </button>
      {loadError && <span className="text-xs text-red-600">{loadError}</span>}

      {confirmDisable && (
        <Modal title={`Disable ${clientName}?`} tone="warning" onClose={() => setConfirmDisable(false)}>
          <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" />
            <ul className="space-y-1">
              <li>Their admins and staff won&apos;t be able to log in.</li>
              <li>Their schools will disappear for parents, and no new orders can be placed.</li>
              <li>Nothing is deleted. You can switch them back on any time.</li>
            </ul>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDisable(false)}>
              Cancel
            </Button>
            <button
              onClick={() => setDisabled(true)}
              disabled={toggling}
              className="rounded-xl bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {toggling ? "Disabling…" : "Disable client"}
            </button>
          </div>
        </Modal>
      )}

      {preview && (
        <Modal title={`Delete ${clientName}`} tone="danger" onClose={() => setPreview(null)}>
          <form action={action} className="space-y-4 text-sm">
            <input type="hidden" name="client_id" value={clientId} />
            <div className="rounded-xl bg-red-50 p-4 text-red-900">
              <p className="flex items-center gap-2 font-bold">
                <TriangleAlert className="h-5 w-5 text-red-600" /> This permanently deletes:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5">
                <li>
                  {preview.schools} school{preview.schools === 1 ? "" : "s"} with their menus and settings
                </li>
                <li>{preview.orders} orders and bills (including tax invoices)</li>
                <li>{preview.students} students</li>
                <li>
                  {preview.accounts_deleted} account{preview.accounts_deleted === 1 ? "" : "s"} with no other school
                </li>
                {Number(preview.wallet_balance) > 0 && (
                  <li className="font-bold">
                    {formatINR(Number(preview.wallet_balance))} of parents&apos; wallet money. Refund it first.
                  </li>
                )}
              </ul>
              <p className="mt-2">
                This can&apos;t be undone. To keep their records, use the <strong>Disable</strong> toggle instead.
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
    </div>
  );
}
