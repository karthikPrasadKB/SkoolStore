"use client";

import { useState } from "react";
import { Info } from "lucide-react";

// A small "i" icon that shows a tip on hover, keyboard focus, or tap (for phones).
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="rounded-full p-0.5 text-slate-400 hover:text-accent-600 focus:text-accent-600 focus:outline-none"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg"
        >
          {text}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
}
