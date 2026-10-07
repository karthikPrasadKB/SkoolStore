"use client";

import { useState, useTransition } from "react";
import { GraduationCap, Plus, Wallet, X } from "lucide-react";
import { formatINR } from "@/lib/menu";
import { topUpWallet, type StudentMatch } from "./actions";

type Student = NonNullable<StudentMatch>;

// What the child can still spend from the wallet today: limited by the balance and the parent's daily limit.
export function walletSpendable(student: Student) {
  if (!student.has_wallet || !student.wallet_allowed) return 0;
  const limitLeft = student.daily_limit === null ? Infinity : Math.max(student.daily_limit - student.spent_today, 0);
  return Math.min(student.balance, limitLeft);
}

// The found student, their family wallet, and a quick top-up form.
export function StudentCard({
  student,
  showCode,
  onRemove,
  onBalanceChange,
}: {
  student: Student;
  showCode: boolean;
  onRemove: () => void;
  onBalanceChange: (balance: number) => void;
}) {
  const [toppingUp, setToppingUp] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "upi">("cash");
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submitTopUp() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setMessage({ kind: "error", text: "Enter an amount." });
      return;
    }
    startTransition(async () => {
      const result = await topUpWallet(student.code, value, method);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      onBalanceChange(result.balance);
      setMessage({ kind: "success", text: `Added ${formatINR(value)} by ${method === "upi" ? "UPI" : "cash"}.` });
      setAmount("");
      setToppingUp(false);
    });
  }

  let walletLine: string;
  if (!student.has_wallet) walletLine = "No parent account linked, so no wallet";
  else if (!student.wallet_allowed) walletLine = `Wallet ${formatINR(student.balance)} · parent hasn't allowed self-spend`;
  else if (student.daily_limit === null) walletLine = `Wallet ${formatINR(student.balance)} · no daily limit`;
  else walletLine = `Wallet ${formatINR(student.balance)} · ${formatINR(Math.max(student.daily_limit - student.spent_today, 0))} left today`;

  return (
    <div className="rounded-xl bg-emerald-50 px-3 py-2">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-5 w-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-semibold text-emerald-900">{student.name}</p>
          <p className="text-xs text-emerald-700">
            {student.class_name || "No class"}
            {student.id_card_number && ` · ID ${student.id_card_number}`}
            {showCode && ` · code ${student.code}`}
          </p>
        </div>
        <button onClick={onRemove} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100" title="Remove student">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-emerald-100 pt-2 text-xs">
        <Wallet className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="flex-1 font-medium text-emerald-900">{walletLine}</span>
        {student.has_wallet && !toppingUp && (
          <button
            onClick={() => {
              setToppingUp(true);
              setMessage(null);
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <Plus className="h-3.5 w-3.5" /> Top up
          </button>
        )}
      </div>

      {toppingUp && (
        <div className="mt-2 space-y-2 rounded-lg bg-white p-2">
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitTopUp()}
              type="number"
              min="1"
              inputMode="decimal"
              autoFocus
              placeholder="Amount ₹"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500"
            />
            <div className="flex shrink-0 rounded-lg border border-slate-300 p-0.5 text-xs font-semibold">
              {(["cash", "upi"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-md px-2.5 py-1 ${method === m ? "bg-slate-900 text-white" : "text-slate-600"}`}
                >
                  {m === "upi" ? "UPI" : "Cash"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={submitTopUp}
              disabled={pending}
              className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending ? "Adding…" : `Add ${amount ? formatINR(Number(amount)) : ""} to wallet`}
            </button>
            <button
              onClick={() => setToppingUp(false)}
              className="rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`mt-1 text-xs ${message.kind === "error" ? "text-red-600" : "text-emerald-700"}`}>{message.text}</p>
      )}
    </div>
  );
}
