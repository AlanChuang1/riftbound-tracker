"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Library,
  ScanLine,
  Layers,
  User,
  Sparkles,
} from "lucide-react";

const tabs = [
  { href: "/cards", label: "Cards", icon: Search },
  { href: "/collection", label: "Collection", icon: Library },
  { href: "/scanner", label: "Scan Card", icon: ScanLine },
  { href: "/decks", label: "Decks", icon: Layers },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 hidden md:flex w-60 flex-col border-r border-border bg-card-bg">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <Sparkles size={20} className="text-primary" />
        <span className="font-bold text-base tracking-tight">Riftbound Tracker</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted">Card data from Riftcodex</p>
      </div>
    </aside>
  );
}
