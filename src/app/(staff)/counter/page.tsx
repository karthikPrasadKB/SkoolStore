import { ComingSoon } from "@/components/coming-soon";
import { requireRole } from "@/lib/auth";

export default async function CounterPage() {
  await requireRole(["admin", "canteen_staff", "counter_staff"]);
  return (
    <ComingSoon
      title="Counter"
      description="Bill walk-up customers and hand over pre-orders."
      phase={3}
      items={["Quick billing for walk-up orders", "Cash and UPI payments", "Scan ID cards to hand over pre-orders"]}
    />
  );
}
