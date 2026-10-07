import Link from "next/link";
import { Mail, Phone, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReplyForm } from "./reply-form";

type RequestRow = {
  id: string;
  phone: string;
  email: string;
  id_card_number: string | null;
  message: string;
  status: "open" | "resolved";
  admin_reply: string | null;
  created_at: string;
  resolved_at: string | null;
  parent: { full_name: string } | null;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export default async function RequestsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_requests")
    .select(
      "id, phone, email, id_card_number, message, status, admin_reply, created_at, resolved_at, parent:profiles!support_requests_parent_id_fkey(full_name)",
    )
    .order("status")
    .order("created_at", { ascending: false })
    .limit(100);
  const requests = (data ?? []) as unknown as RequestRow[];
  const open = requests.filter((r) => r.status === "open");
  const resolved = requests.filter((r) => r.status === "resolved");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Requests from parents" description="Questions and problems parents have sent to the school." />

      <h2 className="mb-3 font-semibold text-slate-900">Open ({open.length})</h2>
      {open.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">No open requests. 🎉</Card>
      ) : (
        <div className="space-y-4">
          {open.map((request) => (
            <Card key={request.id} className="border-amber-200">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{request.parent?.full_name ?? "Parent"}</p>
                  <p className="text-xs text-slate-500">{when(request.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-sm">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {request.phone}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {request.email}
                  </span>
                </div>
              </div>
              {request.id_card_number && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono font-semibold">ID {request.id_card_number}</span>
                  <Link
                    href={`/admin/students?q=${encodeURIComponent(request.id_card_number)}`}
                    className="flex items-center gap-1 font-semibold text-brand-600 hover:underline"
                  >
                    <Search className="h-3.5 w-3.5" /> Find who has this ID
                  </Link>
                </div>
              )}
              <p className="mt-3 whitespace-pre-line text-sm text-slate-800">{request.message}</p>
              <ReplyForm requestId={request.id} />
            </Card>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 font-semibold text-slate-900">Resolved</h2>
          <div className="space-y-3">
            {resolved.map((request) => (
              <Card key={request.id} className="p-4 opacity-80">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-900">{request.parent?.full_name ?? "Parent"}</span>
                  <span className="text-xs text-slate-500">
                    Resolved {request.resolved_at ? when(request.resolved_at) : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{request.message}</p>
                {request.admin_reply && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold">Reply:</span> {request.admin_reply}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
