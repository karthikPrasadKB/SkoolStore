import { PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/school";
import { createClient } from "@/lib/supabase/server";
import { BreakSlots, type BreakSlot } from "./break-slots";
import { SchoolStatus } from "./school-status";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const profile = await requireRole(["admin"]);
  const { new: isNew } = await searchParams;
  const school = await getSchool();
  const supabase = await createClient();
  const { data: slotRows } = await supabase
    .from("break_slots")
    .select("id, name, starts_at, capacity")
    .eq("school_id", school.id)
    .eq("is_active", true)
    .order("starts_at");

  return (
    <div className="max-w-3xl">
      <PageHeader title="School settings" description="Bill details, GST, pre-order times and discounts." />
      {isNew === "1" && (
        <div className="mb-6 flex gap-3 rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-900">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="text-sm">
            <p className="font-semibold">{school.name} is ready!</p>
            <p className="mt-0.5">
              Fill in the details below, then add the menu and staff. Parents will find it by its name. Use the school
              switcher in the sidebar to move between your schools.
            </p>
          </div>
        </div>
      )}
      <div className="mb-6">
        <BreakSlots slots={(slotRows ?? []) as BreakSlot[]} />
      </div>
      <SettingsForm school={school} />
      <div className="mt-6">
        <SchoolStatus schoolName={school.name} disabled={profile.school.is_disabled} />
      </div>
    </div>
  );
}
