"use client";

import { useRouter } from "next/navigation";

export type View = "day" | "month" | "year";

// Filters in one row above the charts: Day / Month / Year, and which one.
export function ReportFilters({ view, value, years }: { view: View; value: string; years: number[] }) {
  const router = useRouter();
  const go = (v: View, val: string) => router.push(`/admin/reports?view=${v}&value=${val}`);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

  const defaults: Record<View, string> = { day: today, month: today.slice(0, 7), year: today.slice(0, 4) };
  const input =
    "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {(["day", "month", "year"] as const).map((v) => (
          <button
            key={v}
            onClick={() => go(v, defaults[v])}
            className={`rounded-lg px-4 py-1.5 capitalize transition ${
              view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      {view === "day" && (
        <input
          type="date"
          value={value}
          max={today}
          onChange={(e) => e.target.value && go("day", e.target.value)}
          className={input}
        />
      )}
      {view === "month" && (
        <input
          type="month"
          value={value}
          max={today.slice(0, 7)}
          onChange={(e) => e.target.value && go("month", e.target.value)}
          className={input}
        />
      )}
      {view === "year" && (
        <select value={value} onChange={(e) => go("year", e.target.value)} className={input}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
