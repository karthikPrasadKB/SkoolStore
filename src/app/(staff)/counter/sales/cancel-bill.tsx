"use client";

import { useActionState, useState } from "react";
import { cancelOrder, type CancelState } from "../actions";

// "Cancel" link that opens a small form asking for the reason.
export function CancelBill({ orderId, billNumber }: { orderId: string; billNumber: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelOrder, {});

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
      >
        Cancel
      </button>
    );
  }

  return (
    <form action={action} className="flex w-64 flex-col gap-1.5 text-left">
      <input type="hidden" name="id" value={orderId} />
      <input
        name="reason"
        required
        minLength={3}
        maxLength={200}
        autoFocus
        placeholder={`Why cancel bill #${billNumber}?`}
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-red-400"
      />
      <div className="flex gap-1.5">
        <button
          disabled={pending}
          className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Cancelling…" : "Cancel bill"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
        >
          Keep
        </button>
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
