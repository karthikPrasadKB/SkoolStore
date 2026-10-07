import { Search } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";
import { AddStudentForm } from "./add-student-form";
import { StudentRow, type StudentRowData } from "./student-row";

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  await requireRole(["admin"]);
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim().replace(/[%_,()]/g, "") : "";

  const supabase = await createClient();
  const school = await getSchool();
  let query = supabase
    .from("students")
    .select("id, full_name, class_name, code, id_card_number, parent:profiles(full_name, phone)")
    .order("class_name")
    .order("full_name");
  if (search) query = query.or(`full_name.ilike.%${search}%,class_name.ilike.%${search}%,code.eq.${search.toUpperCase()},id_card_number.ilike.${search}`);
  const { data } = await query;
  const students = (data ?? []) as unknown as StudentRowData[];

  return (
    <>
      <PageHeader
        title="Students"
        description="Parents add their own children. You can also add students here and link a parent later."
      />

      <Card>
        <AddStudentForm />
      </Card>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <p className="font-semibold text-slate-900">{students.length} students</p>
          <form action="/admin/students" className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Search name, class or ID number"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </form>
        </div>
        {students.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            {search ? "No students match." : "No students yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Class</th>
                  <th className="px-5 py-3 font-semibold">ID card</th>
                  {school.use_canteen_codes && <th className="px-5 py-3 font-semibold">Canteen code</th>}
                  <th className="px-5 py-3 font-semibold">Parent</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <StudentRow key={student.id} student={student} showCode={school.use_canteen_codes} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
