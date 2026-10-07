import Link from "next/link";

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="skool-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#skool-logo)" />
      <path
        d="M12 16h16l-1.6 12.2a2 2 0 0 1-2 1.8h-8.8a2 2 0 0 1-2-1.8L12 16Z"
        fill="white"
      />
      <path
        d="M16 16v-2a4 4 0 0 1 8 0v2"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <LogoMark />
      <span className={`text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
        Skool<span className={light ? "text-accent-400" : "text-brand-600"}>Store</span>
      </span>
    </Link>
  );
}
