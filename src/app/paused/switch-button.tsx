"use client";

import { useTransition } from "react";
import { switchSchool } from "@/app/(staff)/school-actions";

export function SwitchButton({ schoolId, name }: { schoolId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => void (await switchSchool(schoolId)))}
      disabled={pending}
      className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Switching…" : `Go to ${name}`}
    </button>
  );
}
