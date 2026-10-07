import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getSchool } from "@/lib/school";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  await requireRole(["admin"]);
  const school = await getSchool();

  return (
    <div className="max-w-3xl">
      <PageHeader title="School settings" description="Bill details, GST, pre-order times and discounts." />
      <SettingsForm school={school} />
    </div>
  );
}
