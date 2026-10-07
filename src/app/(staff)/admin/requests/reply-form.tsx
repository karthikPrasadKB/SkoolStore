"use client";

import { useActionState } from "react";
import { resolveRequest, type ReplyState } from "./actions";

export function ReplyForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(resolveRequest, {});

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={requestId} />
      <textarea
        name="reply"
        rows={2}
        maxLength={2000}
        placeholder="Reply to the parent (optional), e.g. Fixed. The ID now belongs to your child."
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
      />
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Mark resolved"}
        </button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
