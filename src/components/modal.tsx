"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// A pop-up window over the page. Closes with the ✕, the Escape key, or a click outside.
export function Modal({
  title,
  onClose,
  children,
  tone = "default",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger" | "warning";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const titleColor = tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-slate-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-left shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className={`text-lg font-bold ${titleColor}`}>{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
