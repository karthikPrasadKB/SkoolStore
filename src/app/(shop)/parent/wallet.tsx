import { ArrowDownLeft, ArrowUpRight, RotateCcw, Wallet } from "lucide-react";
import { formatINR } from "@/lib/menu";

export type WalletBalance = { school_id: string; school_name: string; balance: number };
export type WalletTxn = {
  id: string;
  type: "topup" | "purchase" | "refund" | "adjustment";
  amount: number;
  balance_after: number;
  payment_method: string | null;
  note: string | null;
  created_at: string;
  school_name: string;
  student_name: string | null;
};

const TYPE_LABELS: Record<WalletTxn["type"], string> = {
  topup: "Top-up",
  purchase: "Purchase",
  refund: "Refund",
  adjustment: "Adjustment",
};

// Family wallet: one balance per school, and every top-up, purchase and refund.
export function WalletSection({ balances, transactions }: { balances: WalletBalance[]; transactions: WalletTxn[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-slate-900">Wallet</h2>
      <p className="mt-1 text-sm text-slate-500">
        Each school&apos;s canteen keeps its own balance. Top up with cash or UPI at the canteen counter. Online top-ups are coming soon.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((wallet) => (
          <div
            key={wallet.school_id}
            className="rounded-2xl bg-gradient-to-br from-slate-900 to-brand-900 p-5 text-white shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm text-brand-100">
              <Wallet className="h-4 w-4" /> {wallet.school_name}
            </div>
            <p className="mt-3 text-3xl font-extrabold">{formatINR(wallet.balance)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <p className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">History</p>
        {transactions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No wallet activity yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {transactions.map((txn) => {
              const incoming = txn.amount > 0;
              const Icon = txn.type === "refund" ? RotateCcw : incoming ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={txn.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`rounded-xl p-2 ${incoming ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-slate-900">
                      {TYPE_LABELS[txn.type]}
                      {txn.student_name && <span className="font-normal text-slate-500"> · {txn.student_name}</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {new Date(txn.created_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {" · "}
                      {txn.school_name}
                      {txn.payment_method && txn.type === "topup" && ` · ${txn.payment_method === "upi" ? "UPI" : txn.payment_method}`}
                      {txn.note && ` · ${txn.note}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${incoming ? "text-emerald-600" : "text-slate-900"}`}>
                      {incoming ? "+" : "−"}
                      {formatINR(Math.abs(txn.amount))}
                    </p>
                    <p className="text-xs text-slate-400">Bal {formatINR(txn.balance_after)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
