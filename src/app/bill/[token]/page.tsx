import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FoodTypeMark } from "@/components/food-type-mark";
import { formatINR, type FoodType } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import { PrintOnLoad } from "./print-on-load";

export const metadata: Metadata = { title: "Bill — SkoolStore", robots: { index: false } };

type Bill = {
  school: { name: string; address: string; phone: string; gstin: string };
  bill_number: number;
  status: string;
  created_at: string;
  customer_name: string | null;
  student: { name: string; class_name: string } | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  gst_amount: number;
  payment_method: string | null;
  amount_received: number | null;
  items: {
    name: string;
    food_type: FoodType;
    options: { group: string; name: string }[];
    unit_price: number;
    quantity: number;
    line_total: number;
  }[];
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  pluxee: "Pluxee",
  wallet: "SkoolStore wallet",
  online: "Online",
};

// The online bill. Anyone with the link can open it; it's also the printable receipt.
export default async function BillPage({ params, searchParams }: PageProps<"/bill/[token]">) {
  const { token } = await params;
  const { print } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_bill", { p_token: token });
  if (!data) notFound();
  const bill = data as Bill;

  const date = new Date(bill.created_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const change = bill.amount_received !== null ? Number(bill.amount_received) - Number(bill.total) : 0;

  return (
    <main className="flex flex-1 flex-col items-center bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } body { background: white; } }`}</style>
      <div className="mb-4 flex w-full max-w-sm justify-end print:hidden">
        <PrintOnLoad auto={print === "1"} />
      </div>

      <article className="w-full max-w-sm rounded-2xl bg-white p-6 font-mono text-sm text-slate-900 shadow-sm print:max-w-none print:rounded-none print:p-0 print:text-xs print:shadow-none">
        <header className="text-center">
          <h1 className="font-sans text-lg font-extrabold">{bill.school.name}</h1>
          {bill.school.address && <p>{bill.school.address}</p>}
          {bill.school.phone && <p>Ph: {bill.school.phone}</p>}
          {bill.school.gstin && <p>GSTIN: {bill.school.gstin}</p>}
          <p className="mt-2 font-sans font-bold">{bill.school.gstin ? "TAX INVOICE" : "BILL"}</p>
        </header>

        <div className="my-3 border-t border-dashed border-slate-400" />
        <div className="flex justify-between">
          <span>Bill #{bill.bill_number}</span>
          <span>{date}</span>
        </div>
        {bill.student && (
          <p>
            Student: {bill.student.name}
            {bill.student.class_name && ` (${bill.student.class_name})`}
          </p>
        )}
        {bill.customer_name && <p>Customer: {bill.customer_name}</p>}
        {bill.status === "cancelled" && (
          <p className="mt-2 rounded bg-red-50 py-1 text-center font-sans font-bold text-red-700">CANCELLED</p>
        )}

        <div className="my-3 border-t border-dashed border-slate-400" />
        <ul className="space-y-2">
          {bill.items.map((item, i) => (
            <li key={i}>
              <div className="flex justify-between gap-2">
                <span className="flex items-start gap-1.5">
                  <FoodTypeMark type={item.food_type} className="mt-0.5 h-3 w-3 print:hidden" />
                  {item.name}
                </span>
                <span>{formatINR(Number(item.line_total))}</span>
              </div>
              {item.options.length > 0 && (
                <p className="pl-[18px] text-xs text-slate-500 print:pl-0">{item.options.map((o) => o.name).join(", ")}</p>
              )}
              <p className="pl-[18px] text-xs text-slate-500 print:pl-0">
                {item.quantity} × {formatINR(Number(item.unit_price))}
              </p>
            </li>
          ))}
        </ul>

        <div className="my-3 border-t border-dashed border-slate-400" />
        <div className="space-y-1">
          {Number(bill.discount_amount) > 0 && (
            <>
              <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(Number(bill.subtotal))}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>−{formatINR(Number(bill.discount_amount))}</span></div>
            </>
          )}
          <div className="flex justify-between font-sans text-base font-extrabold">
            <span>TOTAL</span>
            <span>{formatINR(Number(bill.total))}</span>
          </div>
          {Number(bill.gst_amount) > 0 &&
            (bill.school.gstin ? (
              // Within a state, GST is shown as equal central (CGST) and state (SGST) parts.
              <div className="text-xs text-slate-500">
                <p>Prices include GST:</p>
                <div className="flex justify-between"><span>CGST</span><span>{formatINR(Number(bill.gst_amount) / 2)}</span></div>
                <div className="flex justify-between"><span>SGST</span><span>{formatINR(Number(bill.gst_amount) / 2)}</span></div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Includes GST of {formatINR(Number(bill.gst_amount))}</p>
            ))}
          {bill.payment_method && (
            <div className="flex justify-between pt-1">
              <span>Paid by {PAYMENT_LABELS[bill.payment_method] ?? bill.payment_method}</span>
              {bill.amount_received !== null && <span>{formatINR(Number(bill.amount_received))}</span>}
            </div>
          )}
          {change > 0 && (
            <div className="flex justify-between"><span>Change</span><span>{formatINR(change)}</span></div>
          )}
        </div>

        <div className="my-3 border-t border-dashed border-slate-400" />
        <p className="text-center text-xs">Thank you! · Powered by SkoolStore</p>
      </article>
    </main>
  );
}
