"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Library, Plus, Minus, Trash2, Search, Filter } from "lucide-react";
import Image from "next/image";

interface Card {
  id: string;
  name: string;
  type: string;
  rarity: string;
  faction?: string;
  cost?: number;
  artUrl?: string;
  thumbnailUrl?: string;
}

interface CollectionEntry {
  id: string;
  cardId: string;
  quantity: number;
  variant: string;
  card: Card;
}

export default function CollectionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [factionFilter, setFactionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/collection");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) fetchCollection();
  }, [session]);

  async function fetchCollection() {
    setLoading(true);
    try {
      const res = await fetch("/api/collection");
      if (res.ok) {
        const data = await res.json();
        setCollection(data);
      }
    } catch {
      console.error("Failed to fetch collection");
    }
    setLoading(false);
  }

  async function updateQuantity(entry: CollectionEntry, delta: number) {
    const newQty = entry.quantity + delta;
    if (newQty <= 0) {
      await removeEntry(entry.id);
      return;
    }
    // Optimistic update
    setCollection((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, quantity: newQty } : e))
    );
    await fetch("/api/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: entry.cardId,
        quantity: delta,
        variant: entry.variant,
      }),
    });
  }

  async function removeEntry(id: string) {
    setCollection((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/collection?id=${id}`, { method: "DELETE" });
  }

  const filtered = collection.filter((entry) => {
    if (searchQuery && !entry.card.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (factionFilter && entry.card.faction !== factionFilter) return false;
    if (typeFilter && entry.card.type !== typeFilter) return false;
    if (rarityFilter && entry.card.rarity !== rarityFilter) return false;
    return true;
  });

  const hasFilters = factionFilter || typeFilter || rarityFilter;

  function clearFilters() {
    setFactionFilter("");
    setTypeFilter("");
    setRarityFilter("");
  }

  const totalCards = collection.reduce((sum, e) => sum + e.quantity, 0);
  const uniqueCards = collection.length;

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-card-bg rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-card-bg rounded-lg border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold md:text-2xl">My Collection</h1>
        <p className="text-sm text-muted mt-0.5">
          {uniqueCards} unique &middot; {totalCards} total cards
        </p>
      </div>

      {/* Search + Filter Toggle */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search your collection..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card-bg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary transition"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm transition ${
            hasFilters
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card-bg text-muted hover:text-foreground"
          }`}
        >
          <Filter size={16} />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-4 rounded-lg border border-border bg-card-bg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filters</span>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-primary hover:underline">
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select
              value={factionFilter}
              onChange={(e) => setFactionFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="">All Factions</option>
              <option value="Order">Order</option>
              <option value="Chaos">Chaos</option>
              <option value="Calm">Calm</option>
              <option value="Mind">Mind</option>
              <option value="Fury">Fury</option>
              <option value="Body">Body</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="">All Types</option>
              <option value="Champion">Champion</option>
              <option value="Unit">Unit</option>
              <option value="Spell">Spell</option>
              <option value="Battlefields">Battlefields</option>
              <option value="Gear">Gear</option>
            </select>
            <select
              value={rarityFilter}
              onChange={(e) => setRarityFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="">All Rarities</option>
              <option value="Common">Common</option>
              <option value="Uncommon">Uncommon</option>
              <option value="Rare">Rare</option>
              <option value="Epic">Epic</option>
              <option value="Showcase">Showcase</option>
            </select>
          </div>
        </div>
      )}

      {/* Quick Add Button */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => router.push("/scanner")}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition"
        >
          <Plus size={16} />
          Scan Card
        </button>
        <button
          onClick={() => router.push("/cards")}
          className="flex items-center gap-2 rounded-lg border border-border bg-card-bg px-4 py-2.5 text-sm hover:bg-foreground/5 transition"
        >
          <Search size={16} />
          Browse & Add
        </button>
      </div>

      {/* Collection List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Library size={40} className="text-muted mb-3" />
          <p className="text-muted">
            {collection.length === 0
              ? "Your collection is empty"
              : "No matching cards"}
          </p>
          <p className="text-xs text-muted mt-1">
            {collection.length === 0
              ? "Scan cards or browse to add them"
              : "Try a different search term"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card-bg p-3 hover:border-primary/30 transition"
            >
              {/* Card thumbnail */}
              <div className="relative h-14 w-10 flex-shrink-0 rounded overflow-hidden bg-background">
                {entry.card.thumbnailUrl || entry.card.artUrl ? (
                  <Image
                    src={entry.card.thumbnailUrl || entry.card.artUrl!}
                    alt={entry.card.name}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/10" />
                )}
              </div>

              {/* Card info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{entry.card.name}</p>
                <p className="text-xs text-muted">
                  {entry.card.type} &middot; {entry.card.rarity}
                  {entry.variant !== "Base" && ` &middot; ${entry.variant}`}
                </p>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(entry, -1)}
                  className="p-1.5 rounded-lg border border-border hover:bg-foreground/5 transition"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-semibold w-6 text-center">
                  {entry.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(entry, 1)}
                  className="p-1.5 rounded-lg border border-border hover:bg-foreground/5 transition"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition ml-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
