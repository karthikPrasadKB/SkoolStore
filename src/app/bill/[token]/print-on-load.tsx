"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintOnLoad({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (auto) window.print();
  }, [auto]);

  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 print:hidden"
    >
      <Printer className="h-4 w-4" /> Print
    </button>
  );
}
