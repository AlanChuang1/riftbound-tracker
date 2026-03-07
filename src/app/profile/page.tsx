"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { User, LogOut, Sparkles } from "lucide-react";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/profile");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-lg mx-auto">
        <div className="h-20 bg-card-bg rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="px-4 py-4 md:px-8 md:py-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold md:text-2xl">Profile</h1>

      <div className="rounded-xl border border-border bg-card-bg p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User size={24} />
          </div>
          <div>
            <p className="font-semibold">{session.user?.name}</p>
            <p className="text-sm text-muted">{session.user?.email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card-bg overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Sparkles size={18} className="text-primary" />
          <div>
            <p className="text-sm font-medium">Riftbound Tracker</p>
            <p className="text-xs text-muted">Track cards, build decks, get AI advice</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-danger hover:bg-danger/10 transition"
      >
        <LogOut size={16} />
        Sign Out
      </button>
    </div>
  );
}
