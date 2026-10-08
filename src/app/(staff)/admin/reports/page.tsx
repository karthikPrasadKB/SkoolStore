import { Banknote, Receipt, Smartphone, TrendingUp, Wallet, WalletCards, type LucideIcon } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { addDays, formatDay, todayInIndia } from "@/lib/dates";
import { formatINR } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import { CategoryShare, ColumnChart, type Point, type Share } from "./charts";
import { ReportFilters, type View } from "./report-filters";

type Report = {
  total: number;
  bills: number;
  discounts: number;
  gst: number;
  preorders: number;
  by_method: { method: string | null; total: number }[];
  by_category: Share[];
  by_period: { period: string; total: number }[];
  by_biller: { name: string; bills: number; total: number }[];
};

const METHODS: Record<string, { label: string; icon: LucideIcon }> = {
  cash: { label: "Cash", icon: Banknote },
  upi: { label: "UPI", icon: Smartphone },
  pluxee: { label: "Pluxee", icon: WalletCards },
  wallet: { label: "Wallet", icon: Wallet },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const today = todayInIndia();
  const view: View = params.view === "month" || params.view === "year" ? params.view : "day";
  const raw = typeof params.value === "string" ? params.value : "";

  // Work out the date range and how to group it.
  let value: string, from: string, to: string, group: "hour" | "day" | "month", title: string;
  if (view === "year") {
    value = /^\d{4}$/.test(raw) ? raw : today.slice(0, 4);
    [from, to, group, title] = [`${value}-01-01`, `${value}-12-31`, "month", `Year ${value}`];
  } else if (view === "month") {
    value = /^\d{4}-\d{2}$/.test(raw) ? raw : today.slice(0, 7);
    from = `${value}-01`;
    to = `${value}-${String(daysInMonth(value)).padStart(2, "0")}`;
    group = "day";
    title = new Date(`${from}T00:00:00Z`).toLocaleDateString("en-IN", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    });
  } else {
    value = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
    [from, to, group, title] = [value, value, "hour", value === today ? "Today" : formatDay(value)];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sales_report", { p_from: from, p_to: to, p_group: group });
  const report = (data ?? null) as Report | null;

  // Fill in the gaps so every hour / day / month appears, even with no sales.
  const byPeriod = new Map((report?.by_period ?? []).map((p) => [p.period, Number(p.total)]));
  let points: Point[] = [];
  if (group === "month") {
    points = MONTHS.map((m, i) => {
      const key = `${value}-${String(i + 1).padStart(2, "0")}`;
      return { label: m, full: `${m} ${value}`, value: byPeriod.get(key) ?? 0 };
    });
  } else if (group === "day") {
    points = Array.from({ length: daysInMonth(value) }, (_, i) => {
      const key = addDays(from, i);
      return { label: String(i + 1), full: formatDay(key), value: byPeriod.get(key) ?? 0 };
    });
  } else {
    const hours = [...byPeriod.keys()].map(Number);
    const start = Math.min(7, ...hours);
    const end = Math.max(17, ...hours);
    points = Array.from({ length: end - start + 1 }, (_, i) => {
      const h = start + i;
      const label = `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`;
      return {
        label,
        full: `${label} – ${(h + 1) % 12 || 12}${h + 1 >= 12 && h + 1 < 24 ? "pm" : "am"}`,
        value: byPeriod.get(String(h).padStart(2, "0")) ?? 0,
      };
    });
  }

  const currentYear = Number(today.slice(0, 4));
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const total = Number(report?.total ?? 0);
  const bills = Number(report?.bills ?? 0);

  const stats = [
    { label: "Total sales", value: formatINR(total), icon: TrendingUp },
    { label: "Bills", value: bills.toLocaleString("en-IN"), icon: Receipt },
    { label: "Average bill", value: formatINR(bills ? Math.round(total / bills) : 0), icon: Receipt },
    { label: "GST included", value: formatINR(Number(report?.gst ?? 0)), icon: Receipt },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Sales for a day, a month or a whole year. Cancelled bills are left out."
      />
      <ReportFilters view={view} value={value} years={years} />

      {error ? (
        <Card className="mt-6 text-sm text-red-600">Couldn&apos;t load the report: {error.message}</Card>
      ) : (
        <>
          <h2 className="mt-6 text-lg font-bold text-slate-900">{title}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label} className="p-5">
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{s.value}</p>
              </Card>
            ))}
          </div>
          {(Number(report?.discounts) > 0 || Number(report?.preorders) > 0) && (
            <p className="mt-2 text-sm text-slate-500">
              {Number(report?.preorders) > 0 && `${report?.preorders} pre-orders included. `}
              {Number(report?.discounts) > 0 && `Discounts given: ${formatINR(Number(report?.discounts))}.`}
            </p>
          )}

          <Card className="mt-6">
            <h3 className="font-semibold text-slate-900">
              Sales by {group === "hour" ? "hour (time of billing)" : group === "day" ? "day" : "month"}
            </h3>
            <div className="mt-6">
              <ColumnChart points={points} caption={`Sales by ${group} for ${title}`} />
            </div>
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="font-semibold text-slate-900">Sales by category</h3>
              <p className="mb-4 text-sm text-slate-500">Top 3 categories, with the rest grouped as Others.</p>
              <CategoryShare
                categories={(report?.by_category ?? []).map((c) => ({ name: c.name, total: Number(c.total) }))}
              />
            </Card>

            <div className="space-y-6">
              <Card>
                <h3 className="mb-3 font-semibold text-slate-900">Payment methods</h3>
                {(report?.by_method ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">No sales in this period.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {(report?.by_method ?? []).map((m) => {
                      const info = METHODS[m.method ?? ""] ?? { label: m.method ?? "Other", icon: Receipt };
                      return (
                        <li key={m.method ?? "none"} className="flex items-center gap-3 py-2">
                          <info.icon className="h-4 w-4 text-slate-400" />
                          <span className="flex-1 text-slate-700">{info.label}</span>
                          <span className="font-semibold text-slate-900">{formatINR(Number(m.total))}</span>
                          <span className="w-12 text-right text-slate-500">
                            {total ? Math.round((Number(m.total) / total) * 100) : 0}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
              <Card>
                <h3 className="mb-3 font-semibold text-slate-900">Who billed</h3>
                {(report?.by_biller ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">No sales in this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="pb-2 font-semibold">Biller</th>
                        <th className="pb-2 text-right font-semibold">Bills</th>
                        <th className="pb-2 text-right font-semibold">Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(report?.by_biller ?? []).map((b) => (
                        <tr key={b.name}>
                          <td className="py-2 text-slate-700">{b.name}</td>
                          <td className="py-2 text-right text-slate-600">{b.bills}</td>
                          <td className="py-2 text-right font-semibold text-slate-900">{formatINR(Number(b.total))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
