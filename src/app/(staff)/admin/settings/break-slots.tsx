"use client";

import { useActionState, useRef, useState } from "react";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { Card } from "@/components/ui";
import { formatTime } from "@/lib/menu";
import { removeSlot, saveSlot, type SlotState } from "./actions";

export type BreakSlot = { id: string; name: string; starts_at: string; capacity: number };

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

function SlotForm({ slot, onDone }: { slot?: BreakSlot; onDone: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<SlotState, FormData>(async (prev, formData) => {
    const result = await saveSlot(prev, formData);
    if (result.saved) {
      formRef.current?.reset();
      onDone();
    }
    return result;
  }, {});

  return (
    <form ref={formRef} action={action} className="space-y-2 rounded-xl bg-slate-50 p-3">
      <input type="hidden" name="id" value={slot?.id ?? ""} />
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem]">
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={slot?.name}
          autoFocus
          placeholder="Name, e.g. After 1st period"
          aria-label="Break name"
          className={inputClass}
        />
        <input
          name="starts_at"
          type="time"
          required
          defaultValue={slot?.starts_at.slice(0, 5)}
          aria-label="Time"
          className={inputClass}
        />
        <input
          name="capacity"
          type="number"
          required
          min={1}
          max={5000}
          defaultValue={slot?.capacity}
          placeholder="Max students"
          aria-label="Maximum students"
          className={inputClass}
        />
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          disabled={pending}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : slot ? "Save" : "Add break"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

// Settings section: the breaks when pre-ordered food can be collected.
export function BreakSlots({ slots }: { slots: BreakSlot[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card>
      <h2 className="font-semibold text-slate-900">Pickup times (breaks)</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        When students can collect pre-ordered food, and how many students you can serve in each break. Parents pick
        one and see how many places are left. Leave empty if you don&apos;t need pickup times.
      </p>

      <ul className="mt-4 space-y-2">
        {slots.map((slot) =>
          editingId === slot.id ? (
            <li key={slot.id}>
              <SlotForm slot={slot} onDone={() => setEditingId(null)} />
            </li>
          ) : (
            <li key={slot.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
              <Clock className="h-4 w-4 shrink-0 text-brand-600" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-slate-900">{slot.name}</p>
                <p className="text-slate-500">
                  {formatTime(slot.starts_at)} · up to {slot.capacity} students
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(slot.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <form action={removeSlot}>
                <input type="hidden" name="id" value={slot.id} />
                <ConfirmButton
                  message={`Remove "${slot.name}"? Parents won't be able to choose it any more. Orders already placed keep it.`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </ConfirmButton>
              </form>
            </li>
          ),
        )}
      </ul>

      <div className="mt-3">
        {adding ? (
          <SlotForm onDone={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" /> Add a break
          </button>
        )}
      </div>
    </Card>
  );
}
