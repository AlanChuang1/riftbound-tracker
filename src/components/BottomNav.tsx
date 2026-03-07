"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Library,
  ScanLine,
  Layers,
  User,
} from "lucide-react";

const tabs = [
  { href: "/cards", label: "Cards", icon: Search },
  { href: "/collection", label: "Collection", icon: Library },
  { href: "/scanner", label: "Scan", icon: ScanLine },
  { href: "/decks", label: "Decks", icon: Layers },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card-bg/80 backdrop-blur-xl safe-bottom md:hidden">
      <div className="flex items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
