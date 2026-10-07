"use client";

import { useEffect } from "react";
import { CircleCheck, Printer } from "lucide-react";
import { formatINR } from "@/lib/menu";

export type CompletedSale = {
  bill_number: number;
  public_token: string;
  total: number;
  change: number;
  payment_method: "cash" | "upi" | "pluxee" | "wallet";
  student_name: string | null;
};

// Shown after a sale: change to give back and an optional printed bill.
export function SaleComplete({ sale, onNewSale }: { sale: CompletedSale; onNewSale: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") onNewSale();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNewSale]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <CircleCheck className="mx-auto h-14 w-14 text-emerald-500" />
        <p className="mt-3 text-sm font-semibold text-slate-500">Bill #{sale.bill_number}</p>
        <p className="text-3xl font-extrabold">{formatINR(sale.total)}</p>
        <p className="text-sm text-slate-500">
          Paid by{" "}
          {{ cash: "cash", upi: "UPI", pluxee: "Pluxee", wallet: "wallet" }[sale.payment_method]}
          {sale.student_name && ` · saved to ${sale.student_name}`}
        </p>

        {sale.payment_method === "cash" && sale.change > 0 && (
          <div className="mt-4 rounded-2xl bg-amber-50 py-3">
            <p className="text-sm font-semibold text-amber-800">Give change</p>
            <p className="text-3xl font-extrabold text-amber-900">{formatINR(sale.change)}</p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={() => window.open(`/bill/${sale.public_token}?print=1`, "_blank")}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Print bill
          </button>
          <button
            onClick={onNewSale}
            autoFocus
            className="rounded-xl bg-brand-600 py-3 font-bold text-white hover:bg-brand-700"
          >
            New sale
          </button>
        </div>
      </div>
    </div>
  );
}
