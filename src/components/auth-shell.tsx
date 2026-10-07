import Link from "next/link";
import { CalendarClock, IdCard, Package } from "lucide-react";
import { Logo } from "@/components/logo";

const POINTS = [
  { icon: CalendarClock, text: "Order today or pre-order for the week" },
  { icon: IdCard, text: "Kids pick up with their school ID card" },
  { icon: Package, text: "Live stock and sales for canteen staff" },
];

// Split-screen frame for the login and sign up pages.
export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-600/50 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent-500/30 blur-3xl" />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Lunch, sorted.
            <br />
            <span className="text-accent-400">No queues, no cash.</span>
          </h2>
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-4 text-brand-100">
                <span className="rounded-xl bg-white/10 p-2.5 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-brand-200">Made for school canteens, parents and kids.</p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center bg-white px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-slate-600">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand-600 hover:underline">
      {children}
    </Link>
  );
}
