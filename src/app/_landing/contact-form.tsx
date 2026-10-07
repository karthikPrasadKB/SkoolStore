"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { Alert, Button, Field, TextArea } from "@/components/ui";
import { sendContactMessage, type ContactState } from "./actions";

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactMessage, {});

  if (state.sent) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <CircleCheck className="h-12 w-12 text-emerald-500" />
        <p className="mt-4 text-lg font-semibold text-slate-900">Thanks! We&apos;ve got your message.</p>
        <p className="mt-1 text-slate-500">We&apos;ll get back to you within one working day.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="name" autoComplete="name" required />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" />
        <Field label="School name (optional)" name="school_name" />
      </div>
      <TextArea label="How can we help?" name="message" required maxLength={5000} />
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
