import { ChefHat, Receipt, Shield, Users, type LucideIcon } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { RoleSelect } from "./role-select";

type Member = { id: string; full_name: string; phone: string | null; role: Role; created_at: string };

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`rounded-xl p-3 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

export default async function AdminPage() {
  const profile = await requireRole(["admin"]);

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .eq("school_id", profile.school_id)
    .order("created_at");
  const members = (data ?? []) as Member[];
  const count = (...roles: Role[]) => members.filter((m) => roles.includes(m.role)).length;

  return (
    <>
      <PageHeader title="Dashboard" description={`Overview of ${profile.school.name}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Parents" value={count("parent")} icon={Users} tone="bg-accent-50 text-accent-600" />
        <Stat label="Canteen staff" value={count("canteen_staff")} icon={ChefHat} tone="bg-emerald-50 text-emerald-600" />
        <Stat label="Counter staff" value={count("counter_staff")} icon={Receipt} tone="bg-sky-50 text-sky-600" />
        <Stat label="Admins" value={count("admin")} icon={Shield} tone="bg-brand-50 text-brand-600" />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-6 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">School join code</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <p className="font-mono text-4xl font-bold tracking-[0.3em]">{profile.school.join_code}</p>
          <p className="max-w-sm text-sm text-brand-100">
            Share this code with parents and staff. They enter it when they create an account.
          </p>
        </div>
      </div>

      <Card className="mt-6 p-0">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">People</h2>
          <p className="text-sm text-slate-500">
            Everyone starts as a parent. Change a staff member&apos;s role to give them access.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Phone</th>
                <th className="px-6 py-3 font-semibold">Joined</th>
                <th className="px-6 py-3 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/60">
                  <td className="px-6 py-3 font-medium text-slate-900">{member.full_name || "—"}</td>
                  <td className="px-6 py-3 text-slate-600">{member.phone ?? "—"}</td>
                  <td className="px-6 py-3 text-slate-600">
                    {new Date(member.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </td>
                  <td className="px-6 py-3">
                    {member.id === profile.id ? (
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                        {ROLE_LABELS[member.role]} (you)
                      </span>
                    ) : (
                      <RoleSelect memberId={member.id} role={member.role} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
