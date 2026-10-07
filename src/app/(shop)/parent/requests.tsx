import { MessageSquare } from "lucide-react";

export type ParentRequest = {
  id: string;
  message: string;
  id_card_number: string | null;
  status: "open" | "resolved";
  admin_reply: string | null;
  created_at: string;
  school: { name: string } | null;
};

// The parent's messages to schools, with the admin's reply.
export function ParentRequests({ requests }: { requests: ParentRequest[] }) {
  if (requests.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-slate-900">Messages to the school</h2>
      <ul className="mt-4 space-y-3">
        {requests.map((request) => (
          <li key={request.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <MessageSquare className="h-4 w-4" />
              <span>{request.school?.name ?? "School"}</span>
              <span>·</span>
              <span>
                {new Date(request.created_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 font-semibold ${
                  request.status === "open" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {request.status === "open" ? "Waiting for the school" : "Resolved"}
              </span>
            </div>
            {request.id_card_number && (
              <p className="mt-2 font-mono text-xs font-semibold text-slate-600">ID {request.id_card_number}</p>
            )}
            <p className="mt-1 text-sm text-slate-800">{request.message}</p>
            {request.admin_reply && (
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <p className="text-xs font-semibold text-slate-500">Reply from the school</p>
                <p className="text-slate-800">{request.admin_reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
