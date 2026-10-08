import {
  Building2,
  GraduationCap,
  IndianRupee,
  Mail,
  Phone,
  Receipt,
  School,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { addDays, todayInIndia } from "@/lib/dates";
import { formatINR } from "@/lib/menu";
import { requirePlatformAdmin } from "@/lib/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { AssignClient } from "./assign-client";
import { ClientControls } from "./client-controls";
import { AddClientAdminForm, NewClientForm } from "./forms";

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="rounded-xl bg-brand-50 p-3 text-brand-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

// Superadmin overview of every school. Data is read with the secret key, after the superadmin check.
export default async function HqPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  if (!admin) {
    return <Card className="text-sm text-red-600">The SUPABASE_SECRET_KEY is missing from .env.local.</Card>;
  }

  const today = todayInIndia();
  const since = addDays(today, -30);
  const [clientsRes, schoolsRes, membersRes, studentsRes, parentsRes, ordersRes, messagesRes, clientAdminsRes] =
    await Promise.all([
      admin.from("clients").select("id, name, email, phone, is_disabled, created_at").order("name"),
      admin.from("schools").select("id, name, join_code, client_id, is_disabled, created_at").order("name"),
      admin.from("school_memberships").select("school_id, role, profile:profiles(full_name, username)"),
      admin.from("students").select("school_id"),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "parent"),
      admin.from("orders").select("school_id, total, pickup_date").gte("pickup_date", since).neq("status", "cancelled"),
      admin
        .from("contact_messages")
        .select("id, name, email, phone, school_name, message, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      admin.from("client_admins").select("user_id, client_id, full_name, username"),
    ]);
  const clientAdminRows = (clientAdminsRes.data ?? []) as {
    user_id: string;
    client_id: string;
    full_name: string;
    username: string;
  }[];

  const clients = (clientsRes.data ?? []) as {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    is_disabled: boolean;
    created_at: string;
  }[];
  const schools = (schoolsRes.data ?? []) as {
    id: string;
    name: string;
    join_code: string;
    client_id: string | null;
    is_disabled: boolean;
    created_at: string;
  }[];
  const members = (membersRes.data ?? []) as unknown as {
    school_id: string;
    role: string;
    profile: { full_name: string; username: string | null } | null;
  }[];
  const students = (studentsRes.data ?? []) as { school_id: string }[];
  const orders = (ordersRes.data ?? []) as { school_id: string; total: number; pickup_date: string }[];
  const messages = (messagesRes.data ?? []) as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    school_name: string | null;
    message: string;
    created_at: string;
  }[];

  const countBy = <T,>(rows: T[], key: (row: T) => string) => {
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(key(row), (map.get(key(row)) ?? 0) + 1));
    return map;
  };
  const studentsBySchool = countBy(students, (s) => s.school_id);
  const staffBySchool = countBy(members, (m) => m.school_id);
  const salesBySchool = new Map<string, number>();
  orders.forEach((o) => salesBySchool.set(o.school_id, (salesBySchool.get(o.school_id) ?? 0) + Number(o.total)));
  const todayOrders = orders.filter((o) => o.pickup_date === today);

  return (
    <>
      <PageHeader
        title="Clients & schools"
        description="Everything across SkoolStore. Only superadmins can see this page."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Clients" value={String(clients.length)} icon={Building2} />
        <Stat label="Schools" value={String(schools.length)} icon={School} />
        <Stat label="Students" value={students.length.toLocaleString("en-IN")} icon={GraduationCap} />
        <Stat label="Parents" value={(parentsRes.count ?? 0).toLocaleString("en-IN")} icon={Users} />
        <Stat label="Staff memberships" value={members.length.toLocaleString("en-IN")} icon={Users} />
        <Stat label="Orders today" value={todayOrders.length.toLocaleString("en-IN")} icon={Receipt} />
        <Stat
          label="Sales today"
          value={formatINR(todayOrders.reduce((sum, o) => sum + Number(o.total), 0))}
          icon={IndianRupee}
        />
      </div>

      <div className="mt-8">
        <NewClientForm />
      </div>

      {[...clients, ...(schools.some((sc) => !sc.client_id) ? [null] : [])].map((client) => {
        const clientSchools = schools.filter((sc) => sc.client_id === (client?.id ?? null));
        const clientAdmins = new Map<string, { name: string; schools: string[] }>();
        members
          .filter((m) => m.role === "admin" && clientSchools.some((sc) => sc.id === m.school_id))
          .forEach((m) => {
            const key = m.profile?.username ?? m.profile?.full_name ?? "—";
            const entry = clientAdmins.get(key) ?? {
              name: `${m.profile?.full_name ?? "—"}${m.profile?.username ? ` (${m.profile.username})` : ""}`,
              schools: [],
            };
            entry.schools.push(clientSchools.find((sc) => sc.id === m.school_id)?.name ?? "");
            clientAdmins.set(key, entry);
          });
        // Client admins who haven't created a school yet.
        clientAdminRows
          .filter((a) => a.client_id === client?.id && !clientAdmins.has(a.username))
          .forEach((a) => clientAdmins.set(a.username, { name: `${a.full_name} (${a.username})`, schools: [] }));
        return (
          <Card
            key={client?.id ?? "none"}
            className={`mt-6 p-0 ${client?.is_disabled ? "border-red-200 bg-red-50/30" : ""}`}
          >
            <div className="flex flex-wrap items-start gap-4 border-b border-slate-200 px-6 py-4">
              <div className="min-w-48 flex-1">
                <h2 className="flex items-center gap-2 font-bold text-slate-900">
                  <Building2 className="h-5 w-5 text-brand-600" /> {client?.name ?? "No client"}
                  {client?.is_disabled && (
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                      Disabled
                    </span>
                  )}
                </h2>
                {client ? (
                  (client.email || client.phone) && (
                    <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-slate-500">
                      {client.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" /> {client.email}
                        </span>
                      )}
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" /> {client.phone}
                        </span>
                      )}
                    </p>
                  )
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    Schools created before clients existed. Assign each one to a client.
                  </p>
                )}
                <p className="mt-2 text-sm text-slate-600">
                  Admins:{" "}
                  {clientAdmins.size === 0 ? (
                    <span className="font-semibold text-amber-600">none yet</span>
                  ) : (
                    [...clientAdmins.values()]
                      .map((a) =>
                        a.schools.length === 0
                          ? `${a.name}: hasn't created a school yet`
                          : a.schools.length === clientSchools.length
                            ? a.name
                            : `${a.name}: ${a.schools.join(", ")}`,
                      )
                      .join(" · ")
                  )}
                </p>
              </div>
              {client && (
                <div className="flex flex-col items-end gap-1">
                  {clientSchools.length > 0 && (
                    <AddClientAdminForm
                      clientId={client.id}
                      schools={clientSchools.map((sc) => ({ id: sc.id, name: sc.name }))}
                    />
                  )}
                  <ClientControls clientId={client.id} clientName={client.name} disabled={client.is_disabled} />
                </div>
              )}
            </div>
            {clientSchools.length === 0 && (
              <p className="px-6 py-4 text-sm text-slate-500">
                No schools yet. The client&apos;s admin creates them after logging in.
              </p>
            )}
            <ul className="divide-y divide-slate-100">
              {clientSchools.map((school) => (
                <li key={school.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
                  <div className="min-w-48 flex-1">
                    <p className="flex items-center gap-2 font-semibold text-slate-900">
                      {school.name}
                      {school.is_disabled && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          Disabled by admin
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      Added {new Date(school.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-bold text-slate-900">{studentsBySchool.get(school.id) ?? 0}</p>
                      <p className="text-xs text-slate-500">Students</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{staffBySchool.get(school.id) ?? 0}</p>
                      <p className="text-xs text-slate-500">Staff</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{formatINR(salesBySchool.get(school.id) ?? 0)}</p>
                      <p className="text-xs text-slate-500">Last 30 days</p>
                    </div>
                  </div>
                  {!client && (
                    <AssignClient schoolId={school.id} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
                  )}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      {clients.length === 0 && schools.length === 0 && (
        <Card className="mt-6 py-10 text-center text-sm text-slate-500">No clients yet. Add the first one above.</Card>
      )}

      <Card className="mt-6 p-0">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Messages from the website</h2>
          <p className="text-sm text-slate-500">Sent through the &ldquo;Contact us&rdquo; form on the home page.</p>
        </div>
        {messages.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">No messages yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {messages.map((m) => (
              <li key={m.id} className="px-6 py-4 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-slate-900">{m.name}</span>
                  {m.school_name && <span className="text-slate-500">· {m.school_name}</span>}
                  <span className="ml-auto text-xs text-slate-400">
                    {new Date(m.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {m.email}
                  </span>
                  {m.phone && <span>{m.phone}</span>}
                </p>
                <p className="mt-2 whitespace-pre-line text-slate-800">{m.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
