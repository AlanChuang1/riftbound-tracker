"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Layers, Plus, Trash2, ChevronRight } from "lucide-react";
import Link from "next/link";

interface DeckCard {
  id: string;
  quantity: number;
  card: { id: string; name: string; type: string; cost?: number };
}

interface Deck {
  id: string;
  name: string;
  description?: string;
  champion?: string;
  updatedAt: string;
  cards: DeckCard[];
  _count: { cards: number };
}

export default function DecksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) fetchDecks();
  }, [session]);

  async function fetchDecks() {
    setLoading(true);
    try {
      const res = await fetch("/api/decks");
      if (res.ok) setDecks(await res.json());
    } catch {
      console.error("Failed to fetch decks");
    }
    setLoading(false);
  }

  async function createDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (res.ok) {
        const deck = await res.json();
        router.push(`/decks/${deck.id}`);
      }
    } catch {
      console.error("Failed to create deck");
    }
    setCreating(false);
  }

  async function deleteDeck(id: string) {
    setDecks((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/decks/${id}`, { method: "DELETE" });
  }

  function getTotalCards(deck: Deck) {
    return deck.cards.reduce((sum, c) => sum + c.quantity, 0);
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
        <div className="h-8 w-40 bg-card-bg rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-card-bg rounded-lg border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">My Decks</h1>
          <p className="text-sm text-muted mt-0.5">{decks.length} deck{decks.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition"
        >
          <Plus size={16} />
          New Deck
        </button>
      </div>

      {/* Create Deck Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-t-2xl md:rounded-2xl bg-card-bg border border-border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Create New Deck</h2>
            <form onSubmit={createDeck} className="space-y-3">
              <input
                type="text"
                placeholder="Deck name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary transition"
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary transition resize-none"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-foreground/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50 transition"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deck List */}
      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Layers size={40} className="text-muted mb-3" />
          <p className="text-muted">No decks yet</p>
          <p className="text-xs text-muted mt-1">Create your first deck to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card-bg p-4 hover:border-primary/30 transition"
            >
              <Link href={`/decks/${deck.id}`} className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{deck.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {getTotalCards(deck)} cards
                  {deck.champion && ` • ${deck.champion}`}
                </p>
                {deck.description && (
                  <p className="text-xs text-muted mt-1 truncate">{deck.description}</p>
                )}
              </Link>
              <button
                onClick={() => deleteDeck(deck.id)}
                className="p-2 rounded-lg text-danger hover:bg-danger/10 transition flex-shrink-0"
              >
                <Trash2 size={16} />
              </button>
              <Link href={`/decks/${deck.id}`} className="p-2 text-muted hover:text-foreground flex-shrink-0">
                <ChevronRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
