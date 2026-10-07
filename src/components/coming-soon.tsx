import { Sparkles } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";

export function ComingSoon({
  title,
  description,
  phase,
  items,
}: {
  title: string;
  description?: string;
  phase: number;
  items: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="flex flex-col items-start gap-4 sm:flex-row">
        <div className="rounded-xl bg-brand-50 p-3 text-brand-600">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">Coming in Phase {phase}</p>
          <ul className="mt-2 space-y-1.5 text-slate-600">
            {items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}
