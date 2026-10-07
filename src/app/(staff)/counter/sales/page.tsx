import Link from "next/link";
import { Banknote, ExternalLink, Smartphone, WalletCards, type LucideIcon } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatINR } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import { CancelBill } from "./cancel-bill";

type OrderRow = {
  id: string;
  bill_number: number;
  status: string;
  source: string;
  customer_name: string | null;
  customer_phone: string | null;
  student: { full_name: string; class_name: string } | null;
  total: number;
  discount_amount: number;
  payment_method: string | null;
  public_token: string;
  created_at: string;
  cancel_reason: string | null;
  cancelled_at: string | null;
  canceller: { full_name: string } | null;
  order_items: { quantity: number }[];
};

const METHODS: { value: string; label: string; icon: LucideIcon; tone: string }[] = [
  { value: "cash", label: "Cash", icon: Banknote, tone: "bg-emerald-50 text-emerald-600" },
  { value: "upi", label: "UPI", icon: Smartphone, tone: "bg-sky-50 text-sky-600" },
  { value: "pluxee", label: "Pluxee", icon: WalletCards, tone: "bg-accent-50 text-accent-600" },
];

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export default async function SalesPage() {
  const profile = await requireRole(["admin", "canteen_staff", "counter_staff"]);
  const canCancel = profile.role === "admin";
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("id, bill_number, status, source, customer_name, customer_phone, student:students(full_name, class_name), total, discount_amount, payment_method, public_token, created_at, cancel_reason, cancelled_at, canceller:profiles!orders_cancelled_by_fkey(full_name), order_items(quantity)")
    .eq("pickup_date", todayInIndia())
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as unknown as OrderRow[];
  const valid = orders.filter((o) => o.status !== "cancelled");
  const sumFor = (method: string) =>
    valid.filter((o) => o.payment_method === method).reduce((sum, o) => sum + Number(o.total), 0);
  const total = valid.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <>
      <PageHeader
        title="Today's sales"
        description={new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full" })}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-brand-600 to-brand-900 p-5 text-white">
          <p className="text-sm text-brand-100">Total sales</p>
          <p className="mt-1 text-3xl font-extrabold">{formatINR(total)}</p>
          <p className="text-sm text-brand-100">{valid.length} bills</p>
        </Card>
        {METHODS.map(({ value, label, icon: Icon, tone }) => (
          <Card key={value} className="flex items-center gap-4 p-5">
            <div className={`rounded-xl p-3 ${tone}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold">{formatINR(sumFor(value))}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        {orders.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-slate-500">
            No sales yet today. <Link href="/counter" className="font-semibold text-brand-600 hover:underline">Start a sale</Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Bill</th>
                  <th className="px-5 py-3 font-semibold">Time</th>
                  <th className="px-5 py-3 font-semibold">Student / customer</th>
                  <th className="px-5 py-3 font-semibold">Items</th>
                  <th className="px-5 py-3 font-semibold">Paid by</th>
                  <th className="px-5 py-3 text-right font-semibold">Total</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const cancelled = order.status === "cancelled";
                  const itemCount = order.order_items.reduce((sum, i) => sum + i.quantity, 0);
                  return (
                    <tr key={order.id} className={cancelled ? "text-slate-400" : "hover:bg-slate-50/60"}>
                      <td className="px-5 py-3 font-semibold">
                        #{order.bill_number}
                        {cancelled && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">Cancelled</span>}
                        {cancelled && (
                          <span className="mt-1 block max-w-56 text-xs font-normal text-slate-500">
                            {order.canceller ? `By ${order.canceller.full_name}` : "Cancelled"}
                            {order.cancelled_at &&
                              ` at ${new Date(order.cancelled_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", timeStyle: "short" })}`}
                            {order.cancel_reason && `: ${order.cancel_reason}`}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {new Date(order.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", timeStyle: "short" })}
                      </td>
                      <td className="px-5 py-3">
                        {order.student ? (
                          <>
                            <span className="font-medium text-slate-900">{order.student.full_name}</span>
                            {order.student.class_name && <span className="text-slate-500"> · {order.student.class_name}</span>}
                          </>
                        ) : (
                          <>
                            {order.customer_name ?? (order.customer_phone ? "" : "—")}
                            {order.customer_phone && (
                              <span className={order.customer_name ? "block text-xs text-slate-400" : ""}>{order.customer_phone}</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-5 py-3">{itemCount}</td>
                      <td className="px-5 py-3 capitalize">{order.payment_method === "upi" ? "UPI" : order.payment_method ?? "—"}</td>
                      <td className={`px-5 py-3 text-right font-bold ${cancelled ? "line-through" : "text-slate-900"}`}>
                        {formatINR(Number(order.total))}
                        {Number(order.discount_amount) > 0 && (
                          <span className="block text-xs font-medium text-emerald-600">−{formatINR(Number(order.discount_amount))} off</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/bill/${order.public_token}`}
                            target="_blank"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="View bill"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          {canCancel && !cancelled && (
                            <CancelBill orderId={order.id} billNumber={order.bill_number} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
