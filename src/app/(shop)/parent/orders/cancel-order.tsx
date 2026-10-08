"use client";

import { useActionState } from "react";
import { cancelPreorder, type CancelState } from "../actions";

export function CancelOrderButton({ orderId, total }: { orderId: string; total: string }) {
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelPreorder, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Cancel this order? ${total} will go back to your wallet.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="order_id" value={orderId} />
      <button
        disabled={pending}
        className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Cancel order"}
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
