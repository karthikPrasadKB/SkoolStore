import { PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/school";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  await requireRole(["admin"]);
  const { new: isNew } = await searchParams;
  const school = await getSchool();

  return (
    <div className="max-w-3xl">
      <PageHeader title="School settings" description="Bill details, GST, pre-order times and discounts." />
      {isNew === "1" && (
        <div className="mb-6 flex gap-3 rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-900">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="text-sm">
            <p className="font-semibold">{school.name} is ready!</p>
            <p className="mt-0.5">
              Its join code is <span className="font-mono font-bold">{school.join_code}</span>. Fill in the details
              below, then add the menu and staff. Use the school switcher in the sidebar to move between your schools.
            </p>
          </div>
        </div>
      )}
      <SettingsForm school={school} />
    </div>
  );
}
