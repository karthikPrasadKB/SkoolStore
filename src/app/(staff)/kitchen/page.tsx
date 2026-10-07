import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export default async function KitchenPage() {
  await requireRole(["admin", "canteen_staff"]);
  return (
    <ComingSoon
      title="Menu & stock"
      description="Manage the items your canteen sells."
      phase={2}
      items={["Add and edit items (SKUs) with photos", "Set prices and categories", "Track stock levels and get low-stock alerts"]}
    />
  );
}
