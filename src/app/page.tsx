import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  ChartColumn,
  ChefHat,
  Clock,
  CreditCard,
  IdCard,
  Mail,
  MapPin,
  Package,
  Phone,
  Receipt,
  School,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { ContactForm } from "@/app/_landing/contact-form";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/roles";
import { SITE } from "@/lib/site";

const AUDIENCES = [
  {
    icon: Users,
    title: "For parents",
    text: "Browse the store, pay online and pre-order meals, snacks and stationery for the whole week, from your phone.",
    tone: "bg-accent-50 text-accent-600",
  },
  {
    icon: ChefHat,
    title: "For store staff",
    text: "Know exactly what to prepare. Manage items, prices and stock in one place, and bill at the counter in seconds.",
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: School,
    title: "For school admins",
    text: "See sales, manage staff access and keep every sale accounted for with clear daily reports.",
    tone: "bg-brand-50 text-brand-600",
  },
];

const FEATURES = [
  { icon: CalendarClock, title: "Pre-orders", text: "Parents order today or plan days ahead. The kitchen sees totals in advance." },
  { icon: IdCard, title: "ID card pickup", text: "Kids show their school ID at the counter. No cash, no lost lunch money." },
  { icon: Receipt, title: "Fast counter billing", text: "A simple point-of-sale screen for walk-up orders, built for rush hour." },
  { icon: CreditCard, title: "Cash & online payments", text: "Accept cash and UPI at the counter, and online payments from parents." },
  { icon: Package, title: "Stock management", text: "Track every item and get alerts before popular items run out." },
  { icon: ChartColumn, title: "Sales reports", text: "Daily sales, best sellers and trends, ready whenever you need them." },
];

const STEPS = [
  { title: "Your school joins", text: "We set up your school's store, and parents find it by name when they sign up." },
  { title: "Parents order", text: "Parents sign up, pick their school, add their kids and place orders online." },
  { title: "Kids pick up", text: "At break time, kids show their ID card and collect their food." },
];

export default async function HomePage() {
  const profile = await getProfile();
  if (profile) redirect(homeFor(profile.role));
  // Superadmins have no school profile: send them to the HQ portal.
  if (await isPlatformAdmin()) redirect("/hq");
  // A client's new admin who hasn't created a school yet.
  const supabase = await createClient();
  const { data: pendingClient } = await supabase.rpc("my_pending_client");
  if (pendingClient) redirect("/welcome");

  return (
    <div className="bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 py-4">
          <Logo />
          <nav className="hidden gap-6 text-sm font-semibold text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900">How it works</a>
            <a href="#contact" className="hover:text-slate-900">Contact</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className={buttonClass("ghost", "px-3 sm:px-4")}>
              Log in
            </Link>
            <Link href="/signup" className={buttonClass("primary", "px-3 sm:px-4")}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-white" />
        <div className="absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full bg-accent-100 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-sm font-semibold text-brand-700">
              <Smartphone className="h-4 w-4" /> Built for school stores
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-6xl">
              The smarter <span className="text-brand-600">school store</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">
              SkoolStore lets parents pre-order meals and school essentials online, helps store staff bill and manage stock
              effortlessly, and lets kids pick up their food with just their ID card.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonClass("primary", "px-6 py-3 text-base")}>
                Create an account <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#contact" className={buttonClass("outline", "px-6 py-3 text-base")}>
                Bring SkoolStore to your school
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Secure payments</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-emerald-500" /> No queues at break time</span>
            </div>
          </div>

          {/* Product preview */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-brand-900/10">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-900">Today&apos;s menu</p>
                <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-600">
                  Order by 10:30
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { emoji: "🥪", name: "Veg sandwich", price: 40 },
                  { emoji: "🍛", name: "Lunch combo", price: 80 },
                  { emoji: "🧃", name: "Fresh juice", price: 25 },
                ].map((item) => (
                  <div key={item.name} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                      {item.emoji}
                    </span>
                    <span className="flex-1 font-semibold text-slate-800">{item.name}</span>
                    <span className="font-bold text-slate-900">₹{item.price}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500 text-lg font-bold text-white">
                      +
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-600 px-4 py-3 text-white">
                <span className="font-semibold">Checkout · 2 items</span>
                <span className="font-bold">₹120</span>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 pr-5 shadow-xl sm:flex">
              <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                <Bell className="h-5 w-5" />
              </span>
              <div className="text-sm">
                <p className="font-semibold text-slate-900">Order collected</p>
                <p className="text-slate-500">Aarav picked up lunch</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {AUDIENCES.map(({ icon: Icon, title, text, tone }) => (
            <div key={title} className="rounded-3xl border border-slate-200 p-7">
              <div className={`inline-flex rounded-2xl p-3 ${tone}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-semibold text-brand-600">Features</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Everything your school store needs
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              From the first order of the morning to the end-of-day report.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl bg-white p-7 shadow-sm">
                <div className="inline-flex rounded-2xl bg-brand-600 p-3 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-semibold text-accent-600">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Up and running in three steps
            </h2>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500 text-xl font-extrabold text-white shadow-lg shadow-accent-500/30">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 bg-brand-900 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="font-semibold text-accent-400">Contact us</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Bring SkoolStore to your school
            </h2>
            <p className="mt-4 text-brand-100">
              Run a school or a school store? Tell us a little about it and we&apos;ll show you how SkoolStore works.
            </p>
            <ul className="mt-8 space-y-4">
              <li className="flex items-center gap-3">
                <span className="rounded-xl bg-white/10 p-2.5"><Mail className="h-5 w-5" /></span>
                <a href={`mailto:${SITE.email}`} className="hover:underline">{SITE.email}</a>
              </li>
              <li className="flex items-center gap-3">
                <span className="rounded-xl bg-white/10 p-2.5"><Phone className="h-5 w-5" /></span>
                <span>{SITE.phone}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="rounded-xl bg-white/10 p-2.5"><MapPin className="h-5 w-5" /></span>
                <span>{SITE.address}</span>
              </li>
            </ul>
          </div>
          <div className="rounded-3xl bg-white p-6 text-slate-900 sm:p-8 lg:col-span-3">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-slate-500">
          <Logo />
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
