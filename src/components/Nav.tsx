"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/portfolio", label: "Paper Portfolio" },
  { href: "/ideas", label: "Trade Ideas" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-edge bg-panel">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          <span className="text-accent">eq</span>copilot
          <span className="ml-2 text-xs text-muted font-normal">research · paper-trading only</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "px-3 py-1.5 rounded-lg",
                  active ? "bg-panel2 text-ink" : "text-muted hover:text-ink hover:bg-panel2",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
