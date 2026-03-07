"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Search,
  Sparkles,
  Save,
  Loader2,
  X,
  Download,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Card {
  id: string;
  name: string;
  type: string;
  rarity: string;
  faction?: string;
  cost?: number;
  power?: number;
  artUrl?: string;
  thumbnailUrl?: string;
}

interface DeckCard {
  id: string;
  cardId: string;
  quantity: number;
  card: Card;
}

interface Deck {
  id: string;
  name: string;
  description?: string;
  champion?: string;
  cards: DeckCard[];
}

export default function DeckEditorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const deckId = params.id as string;

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddCards, setShowAddCards] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [searching, setSearching] = useState(false);

  // AI Advisor state
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [advisorMode, setAdvisorMode] = useState<"collection" | "general">("collection");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  // Export state
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);

  // Missing cards state
  const [showMissing, setShowMissing] = useState(false);
  const [missingData, setMissingData] = useState<{
    missing: { card: Card; needed: number; owned: number }[];
    totalMissing: number;
    totalDeckCards: number;
    totalOwned: number;
  } | null>(null);
  const [loadingMissing, setLoadingMissing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push(`/login?callbackUrl=/decks/${deckId}`);
  }, [status, router]);

  useEffect(() => {
    if (session) fetchDeck();
  }, [session, deckId]);

  async function fetchDeck() {
    setLoading(true);
    try {
      const res = await fetch(`/api/decks/${deckId}`);
      if (res.ok) {
        setDeck(await res.json());
      } else {
        router.push("/decks");
      }
    } catch {
      router.push("/decks");
    }
    setLoading(false);
  }

  const searchCards = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/cards?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setSearchResults(data.cards);
    } catch {
      console.error("Search failed");
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchCards(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchCards]);

  async function addCardToDeck(card: Card) {
    if (!deck) return;
    const existing = deck.cards.find((dc) => dc.cardId === card.id);
    const updatedCards = existing
      ? deck.cards.map((dc) =>
          dc.cardId === card.id ? { ...dc, quantity: dc.quantity + 1 } : dc
        )
      : [
          ...deck.cards,
          {
            id: `temp-${card.id}`,
            cardId: card.id,
            quantity: 1,
            card,
          },
        ];
    setDeck({ ...deck, cards: updatedCards });
  }

  function updateCardQuantity(cardId: string, delta: number) {
    if (!deck) return;
    const updatedCards = deck.cards
      .map((dc) =>
        dc.cardId === cardId ? { ...dc, quantity: dc.quantity + delta } : dc
      )
      .filter((dc) => dc.quantity > 0);
    setDeck({ ...deck, cards: updatedCards });
  }

  function removeCard(cardId: string) {
    if (!deck) return;
    setDeck({ ...deck, cards: deck.cards.filter((dc) => dc.cardId !== cardId) });
  }

  async function saveDeck() {
    if (!deck) return;
    setSaving(true);
    try {
      await fetch(`/api/decks/${deckId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deck.name,
          description: deck.description,
          champion: deck.champion,
          cards: deck.cards.map((dc) => ({
            cardId: dc.cardId,
            quantity: dc.quantity,
          })),
        }),
      });
    } catch {
      console.error("Save failed");
    }
    setSaving(false);
  }

  async function getAIAdvice() {
    setAnalyzing(true);
    setAnalysis("");
    try {
      const endpoint =
        advisorMode === "collection"
          ? `/api/decks/${deckId}/improve`
          : `/api/decks/${deckId}/improve?mode=general`;
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      setAnalysis(data.analysis || "No suggestions available.");
    } catch {
      setAnalysis("Failed to get AI advice. Please try again.");
    }
    setAnalyzing(false);
  }

  function getDeckExportText() {
    if (!deck) return "";
    const lines = deck.cards
      .sort((a, b) => a.card.name.localeCompare(b.card.name))
      .map((dc) => `${dc.quantity}x ${dc.card.name}`);
    return `# ${deck.name}\n${lines.join("\n")}`;
  }

  async function copyDeckList() {
    await navigator.clipboard.writeText(getDeckExportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function fetchMissing() {
    setShowMissing(true);
    setLoadingMissing(true);
    try {
      const res = await fetch(`/api/decks/${deckId}/missing`);
      if (res.ok) setMissingData(await res.json());
    } catch {
      // ignore
    }
    setLoadingMissing(false);
  }

  const totalCards = deck?.cards.reduce((sum, dc) => sum + dc.quantity, 0) || 0;

  if (status === "loading" || loading) {
    return (
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-card-bg rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-card-bg rounded-lg border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!deck) return null;

  // Sort cards by cost
  const sortedCards = [...deck.cards].sort(
    (a, b) => (a.card.cost ?? 99) - (b.card.cost ?? 99)
  );

  return (
    <div className="px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/decks" className="p-2 rounded-lg hover:bg-foreground/5 transition">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{deck.name}</h1>
          <p className="text-sm text-muted">{totalCards} cards</p>
        </div>
        <button
          onClick={fetchMissing}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card-bg px-3 py-2 text-sm text-muted font-medium hover:text-foreground hover:bg-foreground/5 transition"
        >
          <AlertCircle size={14} />
          <span className="hidden sm:inline">Missing</span>
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card-bg px-3 py-2 text-sm text-muted font-medium hover:text-foreground hover:bg-foreground/5 transition"
        >
          <Download size={14} />
          <span className="hidden sm:inline">Export</span>
        </button>
        <button
          onClick={() => setShowAdvisor(true)}
          className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary font-medium hover:bg-primary/20 transition"
        >
          <Sparkles size={14} />
          <span className="hidden sm:inline">AI Advice</span>
        </button>
        <button
          onClick={saveDeck}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50 transition"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
      </div>

      {/* Add Cards Button */}
      <button
        onClick={() => setShowAddCards(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-sm text-muted hover:border-primary/50 hover:text-primary transition mb-4"
      >
        <Plus size={16} />
        Add Cards
      </button>

      {/* Deck Card List */}
      {sortedCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted">Deck is empty</p>
          <p className="text-xs text-muted mt-1">Add cards to build your deck</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedCards.map((dc) => (
            <div
              key={dc.cardId}
              className="flex items-center gap-3 rounded-lg border border-border bg-card-bg px-3 py-2.5 hover:border-primary/30 transition"
            >
              <div className="relative h-10 w-7 flex-shrink-0 rounded overflow-hidden bg-background">
                {dc.card.thumbnailUrl || dc.card.artUrl ? (
                  <Image
                    src={dc.card.thumbnailUrl || dc.card.artUrl!}
                    alt={dc.card.name}
                    fill
                    className="object-cover"
                    sizes="28px"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/10" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{dc.card.name}</p>
                <p className="text-[11px] text-muted">
                  {dc.card.type}
                  {dc.card.cost !== null && dc.card.cost !== undefined && ` • ${dc.card.cost} cost`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateCardQuantity(dc.cardId, -1)}
                  className="p-1 rounded border border-border hover:bg-foreground/5 transition"
                >
                  <Minus size={12} />
                </button>
                <span className="text-sm font-semibold w-5 text-center">{dc.quantity}</span>
                <button
                  onClick={() => updateCardQuantity(dc.cardId, 1)}
                  className="p-1 rounded border border-border hover:bg-foreground/5 transition"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => removeCard(dc.cardId)}
                  className="p-1 rounded text-danger hover:bg-danger/10 transition ml-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Cards Modal */}
      {showAddCards && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowAddCards(false)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-t-2xl md:rounded-2xl bg-card-bg border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search cards to add..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary transition"
                  autoFocus
                />
              </div>
              <button onClick={() => setShowAddCards(false)} className="p-2 text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {searching && (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-muted" />
                </div>
              )}
              {!searching && searchResults.length === 0 && searchQuery && (
                <p className="text-sm text-muted text-center py-8">No cards found</p>
              )}
              {!searching && !searchQuery && (
                <p className="text-sm text-muted text-center py-8">
                  Type to search for cards
                </p>
              )}
              {searchResults.map((card) => {
                const inDeck = deck.cards.find((dc) => dc.cardId === card.id);
                return (
                  <button
                    key={card.id}
                    onClick={() => addCardToDeck(card)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-primary/30 transition text-left"
                  >
                    <div className="relative h-10 w-7 flex-shrink-0 rounded overflow-hidden bg-background">
                      {card.thumbnailUrl || card.artUrl ? (
                        <Image
                          src={card.thumbnailUrl || card.artUrl!}
                          alt={card.name}
                          fill
                          className="object-cover"
                          sizes="28px"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{card.name}</p>
                      <p className="text-[11px] text-muted">
                        {card.type} &middot; {card.rarity}
                        {card.cost !== null && card.cost !== undefined && ` &middot; ${card.cost} cost`}
                      </p>
                    </div>
                    {inDeck && (
                      <span className="text-xs text-primary font-medium">{inDeck.quantity}x</span>
                    )}
                    <Plus size={16} className="text-muted flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Missing Cards Modal */}
      {showMissing && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowMissing(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl md:rounded-2xl bg-card-bg border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-bold">Missing Cards</h2>
              <button onClick={() => setShowMissing(false)} className="p-1 text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingMissing ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-muted" />
                </div>
              ) : missingData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-background p-3 text-center">
                      <p className="text-2xl font-bold text-success">{missingData.totalOwned}</p>
                      <p className="text-xs text-muted">Cards owned</p>
                    </div>
                    <div className="rounded-lg bg-background p-3 text-center">
                      <p className="text-2xl font-bold text-danger">{missingData.totalMissing}</p>
                      <p className="text-xs text-muted">Cards missing</p>
                    </div>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div
                      className="bg-success h-2 rounded-full transition-all"
                      style={{ width: `${missingData.totalDeckCards > 0 ? (missingData.totalOwned / missingData.totalDeckCards) * 100 : 0}%` }}
                    />
                  </div>
                  {missingData.missing.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-center">
                      <Check size={32} className="text-success mb-2" />
                      <p className="text-sm font-semibold">You have all the cards!</p>
                      <p className="text-xs text-muted mt-1">This deck is complete.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted font-medium">Need to acquire:</p>
                      {missingData.missing.map((m) => (
                        <div
                          key={m.card.id}
                          className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                        >
                          <div className="relative h-10 w-7 flex-shrink-0 rounded overflow-hidden bg-background">
                            {m.card.thumbnailUrl || m.card.artUrl ? (
                              <Image
                                src={m.card.thumbnailUrl || m.card.artUrl!}
                                alt={m.card.name}
                                fill
                                className="object-cover"
                                sizes="28px"
                              />
                            ) : (
                              <div className="w-full h-full bg-primary/10" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{m.card.name}</p>
                            <p className="text-[11px] text-muted">{m.card.type} &middot; {m.card.rarity}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-danger">
                              {m.needed - m.owned} needed
                            </p>
                            <p className="text-[11px] text-muted">
                              {m.owned}/{m.needed} owned
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted text-center py-8">Failed to load data</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowExport(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl md:rounded-2xl bg-card-bg border border-border p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Export Deck</h2>
              <button onClick={() => setShowExport(false)} className="p-1 text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <textarea
              readOnly
              value={getDeckExportText()}
              rows={Math.min(deck.cards.length + 2, 15)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono outline-none resize-none"
            />
            <button
              onClick={copyDeckList}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
          </div>
        </div>
      )}

      {/* AI Advisor Modal */}
      {showAdvisor && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowAdvisor(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl md:rounded-2xl bg-card-bg border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                <h2 className="font-bold">AI Deck Advisor</h2>
              </div>
              <button onClick={() => setShowAdvisor(false)} className="p-1 text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-border">
              <div className="flex gap-2">
                <button
                  onClick={() => setAdvisorMode("collection")}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                    advisorMode === "collection"
                      ? "bg-primary text-white"
                      : "bg-foreground/5 text-muted hover:text-foreground"
                  }`}
                >
                  From My Collection
                </button>
                <button
                  onClick={() => setAdvisorMode("general")}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                    advisorMode === "general"
                      ? "bg-primary text-white"
                      : "bg-foreground/5 text-muted hover:text-foreground"
                  }`}
                >
                  General Advice
                </button>
              </div>
              <p className="text-xs text-muted mt-2">
                {advisorMode === "collection"
                  ? "Suggest improvements using only cards you own"
                  : "Suggest the best possible improvements regardless of your collection"}
              </p>
              <button
                onClick={getAIAdvice}
                disabled={analyzing}
                className="mt-3 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50 transition"
              >
                {analyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  "Get Suggestions"
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {analysis ? (
                <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                  {analysis}
                </div>
              ) : (
                <p className="text-sm text-muted text-center py-8">
                  Click &quot;Get Suggestions&quot; to analyze your deck
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
