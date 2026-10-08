"use client";

import { useEffect } from "react";
import { CircleCheck, X } from "lucide-react";

// A success message that closes itself after a few seconds, or with the ✕.
export function Flash({ message, onClose, seconds = 8 }: { message: string; onClose: () => void; seconds?: number }) {
  useEffect(() => {
    const timer = setTimeout(onClose, seconds * 1000);
    return () => clearTimeout(timer);
  }, [message, onClose, seconds]);

  return (
    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
        title="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
