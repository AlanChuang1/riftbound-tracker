"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

interface Card {
  id: string;
  name: string;
  description?: string;
  flavorText?: string;
  faction?: string;
  type: string;
  rarity: string;
  cost?: number;
  power?: number;
  might?: number;
  energy?: number;
  set?: string;
  artUrl?: string;
  thumbnailUrl?: string;
}

interface CardsResponse {
  cards: Card[];
  total: number;
  page: number;
  totalPages: number;
}

const RARITY_COLORS: Record<string, string> = {
  Common: "bg-gray-400/20 text-gray-300",
  Uncommon: "bg-green-400/20 text-green-400",
  Rare: "bg-blue-400/20 text-blue-400",
  Epic: "bg-purple-400/20 text-purple-400",
  Legendary: "bg-amber-400/20 text-amber-400",
};

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [faction, setFaction] = useState("");
  const [type, setType] = useState("");
  const [rarity, setRarity] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (faction) params.set("faction", faction);
    if (type) params.set("type", type);
    if (rarity) params.set("rarity", rarity);
    params.set("page", String(page));
    params.set("limit", "24");

    try {
      const res = await fetch(`/api/cards?${params}`);
      const data: CardsResponse = await res.json();
      setCards(data.cards);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      console.error("Failed to fetch cards");
    }
    setLoading(false);
  }, [query, faction, type, rarity, page]);

  useEffect(() => {
    const timer = setTimeout(fetchCards, 300);
    return () => clearTimeout(timer);
  }, [fetchCards]);

  function clearFilters() {
    setFaction("");
    setType("");
    setRarity("");
    setPage(1);
  }

  const hasFilters = faction || type || rarity;

  return (
    <div className="px-4 py-4 md:px-8 md:py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold md:text-2xl">Card Browser</h1>
        <p className="text-sm text-muted mt-0.5">{total} cards</p>
      </div>

      {/* Search + Filter Toggle */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search cards..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={faction}
              onChange={(e) => { setFaction(e.target.value); setPage(1); }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="">All Factions</option>
              <option value="Order">Order</option>
              <option value="Chaos">Chaos</option>
              <option value="Nature">Nature</option>
              <option value="Shadow">Shadow</option>
              <option value="Tech">Tech</option>
            </select>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="">All Types</option>
              <option value="Champion">Champion</option>
              <option value="Unit">Unit</option>
              <option value="Spell">Spell</option>
              <option value="Landmark">Landmark</option>
              <option value="Equipment">Equipment</option>
            </select>
            <select
              value={rarity}
              onChange={(e) => { setRarity(e.target.value); setPage(1); }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="">All Rarities</option>
              <option value="Common">Common</option>
              <option value="Uncommon">Uncommon</option>
              <option value="Rare">Rare</option>
              <option value="Epic">Epic</option>
              <option value="Legendary">Legendary</option>
            </select>
          </div>
        </div>
      )}

      {/* Card Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-lg bg-card-bg border border-border animate-pulse" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search size={40} className="text-muted mb-3" />
          <p className="text-muted">No cards found</p>
          <p className="text-xs text-muted mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => setSelectedCard(card)}
              className="group relative aspect-[3/4] rounded-lg border border-border bg-card-bg overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all text-left"
            >
              {card.thumbnailUrl || card.artUrl ? (
                <Image
                  src={card.thumbnailUrl || card.artUrl!}
                  alt={card.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <span className="text-xs text-muted text-center px-2">{card.name}</span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                <p className="text-xs font-semibold text-white truncate">{card.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {card.cost !== null && card.cost !== undefined && (
                    <span className="text-[10px] bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded">
                      {card.cost}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-300 truncate">{card.type}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-border bg-card-bg disabled:opacity-30 hover:bg-foreground/5 transition"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-muted">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-border bg-card-bg disabled:opacity-30 hover:bg-foreground/5 transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-card-bg border border-border p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">{selectedCard.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${RARITY_COLORS[selectedCard.rarity] || "bg-gray-400/20 text-gray-400"}`}>
                    {selectedCard.rarity}
                  </span>
                  <span className="text-xs text-muted">{selectedCard.type}</span>
                  {selectedCard.faction && (
                    <span className="text-xs text-muted">• {selectedCard.faction}</span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedCard(null)} className="p-1 text-muted hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            {(selectedCard.artUrl || selectedCard.thumbnailUrl) && (
              <div className="relative aspect-[3/4] w-full max-w-xs mx-auto rounded-lg overflow-hidden">
                <Image
                  src={selectedCard.artUrl || selectedCard.thumbnailUrl!}
                  alt={selectedCard.name}
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm">
              {selectedCard.cost !== null && selectedCard.cost !== undefined && (
                <div className="rounded-lg bg-background p-2.5">
                  <span className="text-muted text-xs">Cost</span>
                  <p className="font-semibold">{selectedCard.cost}</p>
                </div>
              )}
              {selectedCard.power !== null && selectedCard.power !== undefined && (
                <div className="rounded-lg bg-background p-2.5">
                  <span className="text-muted text-xs">Power</span>
                  <p className="font-semibold">{selectedCard.power}</p>
                </div>
              )}
              {selectedCard.might !== null && selectedCard.might !== undefined && (
                <div className="rounded-lg bg-background p-2.5">
                  <span className="text-muted text-xs">Might</span>
                  <p className="font-semibold">{selectedCard.might}</p>
                </div>
              )}
              {selectedCard.energy !== null && selectedCard.energy !== undefined && (
                <div className="rounded-lg bg-background p-2.5">
                  <span className="text-muted text-xs">Energy</span>
                  <p className="font-semibold">{selectedCard.energy}</p>
                </div>
              )}
            </div>

            {selectedCard.description && (
              <div>
                <p className="text-xs text-muted mb-1">Effect</p>
                <p className="text-sm">{selectedCard.description}</p>
              </div>
            )}

            {selectedCard.flavorText && (
              <p className="text-xs text-muted italic">&ldquo;{selectedCard.flavorText}&rdquo;</p>
            )}

            {selectedCard.set && (
              <p className="text-xs text-muted">Set: {selectedCard.set}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
