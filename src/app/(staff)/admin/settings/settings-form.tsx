"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Card, Field } from "@/components/ui";
import type { SchoolSettings } from "@/lib/school";
import { saveSettings, type SettingsState } from "./actions";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-500">{hint}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

export function SettingsForm({ school }: { school: SchoolSettings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const hasSaturday = Boolean(school.saturday_open && school.saturday_close);
  const [saturdayMode, setSaturdayMode] = useState<"closed" | "half" | "full">(
    !hasSaturday
      ? "closed"
      : school.saturday_open === school.weekday_open && school.saturday_close === school.weekday_close
        ? "full"
        : "half",
  );

  return (
    <form action={action} className="space-y-6">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.saved && !pending && <Alert kind="success">Settings saved.</Alert>}

      <Section title="School details" hint="Printed at the top of every bill.">
        <Field label="School / canteen name" name="name" defaultValue={school.name} required maxLength={200} />
        <Field label="Address" name="address" defaultValue={school.address} maxLength={300} />
        <Field label="Phone" name="phone" type="tel" defaultValue={school.phone} maxLength={20} />
      </Section>

      <Section
        title="School hours"
        hint="Items set to sell 'all day' are available during these hours. Sunday is closed."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Monday – Friday: opens"
            name="weekday_open"
            type="time"
            defaultValue={school.weekday_open.slice(0, 5)}
            required
          />
          <Field
            label="Monday – Friday: closes"
            name="weekday_close"
            type="time"
            defaultValue={school.weekday_close.slice(0, 5)}
            required
          />
        </div>
        <label className="block sm:w-1/2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Saturday</span>
          <select
            name="saturday_mode"
            value={saturdayMode}
            onChange={(e) => setSaturdayMode(e.target.value as typeof saturdayMode)}
            className={selectClass}
          >
            <option value="closed">Closed</option>
            <option value="half">Half day</option>
            <option value="full">Same as weekdays</option>
          </select>
        </label>
        {saturdayMode === "half" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Saturday: opens"
              name="saturday_open"
              type="time"
              defaultValue={(school.saturday_open ?? school.weekday_open).slice(0, 5)}
              required
            />
            <Field
              label="Saturday: closes"
              name="saturday_close"
              type="time"
              defaultValue={(school.saturday_close ?? "12:30").slice(0, 5)}
              required
            />
          </div>
        )}
      </Section>

      <Section
        title="GST"
        hint="Menu prices include GST. The bill shows how much of the total is GST."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="GSTIN (optional)"
            name="gstin"
            defaultValue={school.gstin}
            maxLength={15}
            className="uppercase"
            placeholder="e.g. 29ABCDE1234F1Z5"
          />
          <Field
            label="Default GST rate (%)"
            name="gst_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={school.gst_rate}
            hint="Used for items that don't set their own rate."
          />
        </div>
      </Section>

      <Section title="Pre-orders" hint="When parents must place orders by.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Orders close at"
            name="preorder_cutoff_time"
            type="time"
            defaultValue={school.preorder_cutoff_time.slice(0, 5)}
            required
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">On</span>
            <select
              name="preorder_cutoff_day"
              defaultValue={school.preorder_cutoff_same_day ? "same" : "before"}
              className={selectClass}
            >
              <option value="before">The day before pickup</option>
              <option value="same">The same day as pickup</option>
            </select>
          </label>
        </div>
      </Section>

      <Section title="Discounts" hint="Admins and canteen staff can always give discounts.">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="counter_discount_allowed"
            defaultChecked={school.counter_discount_allowed}
            className="mt-1 h-4 w-4 accent-brand-600"
          />
          <span>
            <span className="block font-semibold text-slate-900">Counter staff can give discounts</span>
            <span className="block text-sm text-slate-500">Untick to allow discounts only from admins and canteen staff.</span>
          </span>
        </label>
        <div className="sm:w-1/2">
          <Field
            label="Maximum discount for counter staff (%)"
            name="counter_max_discount_percent"
            type="number"
            min="0"
            max="100"
            step="1"
            defaultValue={school.counter_max_discount_percent}
          />
        </div>
      </Section>

      <Button type="submit" disabled={pending} className="px-6 py-3">
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
