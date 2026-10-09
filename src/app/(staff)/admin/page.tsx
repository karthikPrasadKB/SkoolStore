import { ChefHat, GraduationCap, Receipt, Shield, type LucideIcon } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AddStaffForm } from "./add-staff-form";
import { Partners, type Partner } from "./partners";
import { StaffRow, type StaffMember } from "./staff-row";

type Member = StaffMember & { created_at: string };

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
  // Staff only: admins don't need a list of every parent.
  const [{ data }, { count: studentCount }] = await Promise.all([
    supabase
      .from("school_memberships")
      .select("role, created_at, profile:profiles(id, full_name, username, contact_email, phone)")
      .eq("school_id", profile.school_id)
      .order("created_at"),
    supabase.from("students").select("id", { count: "exact", head: true }),
  ]);
  // Staff of this school, with their role here (it can differ at other schools).
  const members: Member[] = (
    (data ?? []) as unknown as { role: Role; created_at: string; profile: Omit<StaffMember, "role"> | null }[]
  )
    .filter((m) => m.profile)
    .map((m) => ({ ...m.profile!, role: m.role, created_at: m.created_at }));
  const admin = createAdminClient();
  const canAddStaff = admin !== null;

  // Partners: everyone who is an admin at any of the schools I'm an admin of.
  const { data: myAdminRows } = await supabase
    .from("school_memberships")
    .select("school:schools(id, name)")
    .eq("profile_id", profile.id)
    .eq("role", "admin");
  const mySchools = ((myAdminRows ?? []) as unknown as { school: { id: string; name: string } | null }[])
    .map((r) => r.school)
    .filter((sc): sc is { id: string; name: string } => Boolean(sc));
  const partners: Partner[] = [];
  if (admin && mySchools.length > 0) {
    const { data: rows } = await admin
      .from("school_memberships")
      .select("school_id, profile:profiles(id, full_name, username)")
      .eq("role", "admin")
      .in(
        "school_id",
        mySchools.map((sc) => sc.id),
      );
    const byPerson = new Map<string, Partner>();
    (
      (rows ?? []) as unknown as {
        school_id: string;
        profile: { id: string; full_name: string; username: string | null } | null;
      }[]
    )
      .filter((r) => r.profile && r.profile.id !== profile.id)
      .forEach((r) => {
        const entry = byPerson.get(r.profile!.id) ?? {
          name: `${r.profile!.full_name}${r.profile!.username ? ` (${r.profile!.username})` : ""}`,
          schools: [],
        };
        entry.schools.push(mySchools.find((sc) => sc.id === r.school_id)?.name ?? "");
        byPerson.set(r.profile!.id, entry);
      });
    partners.push(...byPerson.values());
  }
  const count = (...roles: Role[]) => members.filter((m) => roles.includes(m.role)).length;

  return (
    <>
      <PageHeader title="Dashboard" description={`Overview of ${profile.school.name}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students" value={studentCount ?? 0} icon={GraduationCap} tone="bg-accent-50 text-accent-600" />
        <Stat
          label="Store staff"
          value={count("canteen_staff")}
          icon={ChefHat}
          tone="bg-emerald-50 text-emerald-600"
        />
        <Stat label="Counter staff" value={count("counter_staff")} icon={Receipt} tone="bg-sky-50 text-sky-600" />
        <Stat label="Admins" value={count("admin")} icon={Shield} tone="bg-brand-50 text-brand-600" />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-6 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">Your school</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <p className="text-3xl font-bold sm:text-4xl">{profile.school.name}</p>
          <p className="max-w-sm text-sm text-brand-100">
            Parents find your school by this name when they create an account. You can change it in Settings.
          </p>
        </div>
      </div>

      <Card className="mt-6 p-0">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Staff</h2>
          <p className="mb-4 text-sm text-slate-500">The people who run your store and counter.</p>
          <AddStaffForm ready={canAddStaff} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Login</th>
                <th className="px-6 py-3 font-semibold">Phone</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <StaffRow key={member.id} member={member} isMe={member.id === profile.id} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Partners partners={partners} mySchools={mySchools} />
    </>
  );
}
