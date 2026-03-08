"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Upload,
  Check,
  X,
  Loader2,
  ScanLine,
  Search,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import Image from "next/image";

interface IdentifiedCard {
  id: string;
  name: string;
  type: string;
  rarity: string;
  faction?: string;
  artUrl?: string;
  thumbnailUrl?: string;
}

interface CardEntry {
  card: IdentifiedCard;
  quantity: number;
}

interface PendingConfirmation {
  entries: CardEntry[];
  suggestions?: IdentifiedCard[];
  suggestedNames?: string[];
}

export default function ScannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const [error, setError] = useState("");

  const [detectedEntries, setDetectedEntries] = useState<CardEntry[]>([]);
  const [addedCardIds, setAddedCardIds] = useState<Set<string>>(new Set());

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);

  const [showManualSearch, setShowManualSearch] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const [manualResults, setManualResults] = useState<IdentifiedCard[]>([]);
  const [searchingManual, setSearchingManual] = useState(false);

  const scanningRef = useRef(false);
  const scanPausedRef = useRef(false);

  useEffect(() => {
    scanningRef.current = scanning;
  }, [scanning]);
  useEffect(() => {
    scanPausedRef.current = scanPaused;
  }, [scanPaused]);

  // Auto-scan loop — starts as soon as camera is active
  useEffect(() => {
    if (!cameraActive || scanPaused) return;
    const interval = setInterval(() => {
      if (!scanPausedRef.current && !scanningRef.current) {
        scanFrame();
      }
    }, 3000);
    // Initial scan immediately
    if (!scanningRef.current) scanFrame();
    return () => clearInterval(interval);
  }, [cameraActive, scanPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "unauthenticated") {
    router.push("/login?callbackUrl=/scanner");
    return null;
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setScanPaused(false);
      setError("");
    } catch {
      setError("Could not access camera. Please use file upload instead.");
    }
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setScanPaused(false);
  }

  function captureFrame(): File | null {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], "capture.jpg", { type: mime });
  }

  async function confirmAndAddEntries(entries: CardEntry[]) {
    for (const entry of entries) {
      try {
        await fetch("/api/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: entry.card.id, quantity: entry.quantity }),
        });
        setAddedCardIds((prev) => new Set(prev).add(entry.card.id));
      } catch {
        // silently fail
      }
    }
    setDetectedEntries((prev) => {
      const updated = [...prev];
      for (const entry of entries) {
        const existing = updated.find((e) => e.card.id === entry.card.id);
        if (existing) {
          existing.quantity += entry.quantity;
        } else {
          updated.unshift(entry);
        }
      }
      return updated;
    });
    setPendingConfirm(null);
    setScanPaused(false);
  }

  function removeFromPending(cardId: string) {
    if (!pendingConfirm) return;
    const updated = {
      ...pendingConfirm,
      entries: pendingConfirm.entries.filter((e) => e.card.id !== cardId),
    };
    if (updated.entries.length === 0 && !updated.suggestions?.length) {
      setPendingConfirm(null);
      setScanPaused(false);
    } else {
      setPendingConfirm(updated);
    }
  }

  function updatePendingQuantity(cardId: string, delta: number) {
    if (!pendingConfirm) return;
    setPendingConfirm({
      ...pendingConfirm,
      entries: pendingConfirm.entries
        .map((e) =>
          e.card.id === cardId ? { ...e, quantity: e.quantity + delta } : e
        )
        .filter((e) => e.quantity > 0),
    });
  }

  function removeFromSuggestions(cardId: string) {
    if (!pendingConfirm) return;
    const updated = {
      ...pendingConfirm,
      suggestions: pendingConfirm.suggestions?.filter((c) => c.id !== cardId),
    };
    if (updated.entries.length === 0 && (!updated.suggestions || updated.suggestions.length === 0)) {
      setPendingConfirm(null);
      setScanPaused(false);
    } else {
      setPendingConfirm(updated);
    }
  }

  async function scanFrame() {
    if (scanningRef.current) return;
    const file = captureFrame();
    if (!file) return;
    await doScan(file);
  }

  async function doScan(file: File) {
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/scan", { method: "POST", body: formData });
      const data = await res.json();

      const hasCards = data.identified && data.cards?.length > 0;
      const hasSuggestions = data.suggestions?.length > 0;
      const hasSuggestedNames = data.suggestedNames?.length > 0;

      if (hasCards || hasSuggestions || hasSuggestedNames) {
        setScanPaused(true);
        // Build entries with quantity (count duplicates from the scan)
        const entries: CardEntry[] = [];
        if (hasCards) {
          for (const card of data.cards as IdentifiedCard[]) {
            const existing = entries.find((e) => e.card.id === card.id);
            if (existing) {
              existing.quantity++;
            } else {
              entries.push({ card, quantity: 1 });
            }
          }
        }
        setPendingConfirm({
          entries,
          suggestions: hasSuggestions ? data.suggestions : undefined,
          suggestedNames: hasSuggestedNames ? data.suggestedNames : undefined,
        });
      }
    } catch {
      // will retry next interval
    }
    setScanning(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    await doScan(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function searchCards(query: string) {
    if (!query.trim()) return;
    setSearchingManual(true);
    try {
      const res = await fetch(`/api/cards?q=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setManualResults(data.cards || []);
      }
    } catch {
      // ignore
    }
    setSearchingManual(false);
  }

  async function addManualCard(card: IdentifiedCard) {
    await confirmAndAddEntries([{ card, quantity: 1 }]);
    // Don't close manual search — user may want to add more cards
    setManualQuery("");
    setManualResults([]);
  }

  function clearSession() {
    setDetectedEntries([]);
    setAddedCardIds(new Set());
    setError("");
    setPendingConfirm(null);
    setScanPaused(false);
  }

  return (
    <div className="px-4 py-4 md:px-8 md:py-6 max-w-lg mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold md:text-2xl">Scan Cards</h1>
        <p className="text-sm text-muted mt-0.5">
          Point your camera at cards to auto-detect and add them
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Hidden video element — always in DOM so ref is stable */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera / Upload buttons */}
      {!cameraActive && (
        <div className="space-y-3 mb-4">
          <button
            onClick={startCamera}
            className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card-bg p-8 hover:border-primary/50 transition"
          >
            <Camera size={24} className="text-primary" />
            <span className="text-sm font-medium">Open Camera</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card-bg p-8 hover:border-primary/50 transition disabled:opacity-50"
          >
            {scanning ? (
              <Loader2 size={24} className="text-primary animate-spin" />
            ) : (
              <Upload size={24} className="text-primary" />
            )}
            <span className="text-sm font-medium">
              {scanning ? "Scanning..." : "Upload Image"}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Live Camera View */}
      {cameraActive && (
        <div className="space-y-3 mb-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4]">
            <CameraPreview videoRef={videoRef} />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4 border-2 border-white/20 rounded-lg" />
              {scanning && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1.5">
                  <Loader2 size={12} className="animate-spin text-primary" />
                  <span className="text-[11px] text-white">Scanning...</span>
                </div>
              )}
              {!scanning && !scanPaused && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1.5">
                  <ScanLine size={12} className="text-success" />
                  <span className="text-[11px] text-white">Auto-scanning</span>
                </div>
              )}
              {scanPaused && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1.5">
                  <span className="text-[11px] text-white">Paused</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={stopCamera}
            className="w-full rounded-lg border border-border bg-card-bg py-3 text-sm font-medium hover:bg-foreground/5 transition"
          >
            Close Camera
          </button>
        </div>
      )}

      {/* Confirmation Panel */}
      {pendingConfirm && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          {/* Exact matches */}
          {pendingConfirm.entries.length > 0 && (
            <>
              <p className="text-sm font-semibold">
                Found {pendingConfirm.entries.reduce((sum, e) => sum + e.quantity, 0)} card{pendingConfirm.entries.reduce((sum, e) => sum + e.quantity, 0) > 1 ? "s" : ""}
              </p>
              <div className="space-y-1.5">
                {pendingConfirm.entries.map((entry) => (
                  <div
                    key={entry.card.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card-bg p-3"
                  >
                    {/* Quantity counter */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => updatePendingQuantity(entry.card.id, -1)}
                        className="p-1 rounded text-muted hover:text-foreground hover:bg-foreground/10 transition"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-sm font-semibold w-5 text-center">{entry.quantity}</span>
                      <button
                        onClick={() => updatePendingQuantity(entry.card.id, 1)}
                        className="p-1 rounded text-muted hover:text-foreground hover:bg-foreground/10 transition"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="relative h-12 w-9 flex-shrink-0 rounded overflow-hidden bg-background">
                      {entry.card.thumbnailUrl || entry.card.artUrl ? (
                        <Image
                          src={entry.card.thumbnailUrl || entry.card.artUrl!}
                          alt={entry.card.name}
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.card.name}</p>
                      <p className="text-[11px] text-muted">
                        {entry.card.type} &middot; {entry.card.rarity}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromPending(entry.card.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => confirmAndAddEntries(pendingConfirm.entries)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition"
                >
                  <Check size={14} />
                  Add to Collection
                </button>
                <button
                  onClick={() => {
                    setShowManualSearch(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-card-bg py-2.5 text-sm font-medium hover:bg-foreground/5 transition"
                >
                  <Search size={14} />
                  Manual Entry
                </button>
              </div>
            </>
          )}

          {/* Fuzzy suggestions — when no exact match */}
          {pendingConfirm.suggestions && pendingConfirm.suggestions.length > 0 && (
            <>
              <p className="text-sm font-semibold">
                {pendingConfirm.entries.length > 0 ? "Also found possible matches" : "Best guesses"}
                {pendingConfirm.suggestedNames ? ` for "${pendingConfirm.suggestedNames.join(", ")}"` : ""}
              </p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {pendingConfirm.suggestions.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card-bg p-3"
                  >
                    <div className="relative h-12 w-9 flex-shrink-0 rounded overflow-hidden bg-background">
                      {card.thumbnailUrl || card.artUrl ? (
                        <Image
                          src={card.thumbnailUrl || card.artUrl!}
                          alt={card.name}
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{card.name}</p>
                      <p className="text-[11px] text-muted">
                        {card.type} &middot; {card.rarity}
                      </p>
                    </div>
                    <button
                      onClick={() => confirmAndAddEntries([{ card, quantity: 1 }])}
                      className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover transition flex-shrink-0"
                    >
                      <Plus size={12} />
                      Add
                    </button>
                    <button
                      onClick={() => removeFromSuggestions(card.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition flex-shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              {pendingConfirm.entries.length === 0 && (
                <button
                  onClick={() => {
                    setPendingConfirm(null);
                    setShowManualSearch(true);
                    if (pendingConfirm.suggestedNames?.[0]) {
                      setManualQuery(pendingConfirm.suggestedNames[0]);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card-bg py-2.5 text-sm font-medium hover:bg-foreground/5 transition"
                >
                  <Search size={14} />
                  Manual Entry
                </button>
              )}
            </>
          )}

          {/* No matches and no suggestions */}
          {pendingConfirm.entries.length === 0 && (!pendingConfirm.suggestions || pendingConfirm.suggestions.length === 0) && (
            <>
              <p className="text-sm font-semibold">Could not identify card</p>
              {pendingConfirm.suggestedNames && (
                <p className="text-xs text-muted">
                  Best guess: {pendingConfirm.suggestedNames.join(", ")}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPendingConfirm(null);
                    setShowManualSearch(true);
                    if (pendingConfirm.suggestedNames?.[0]) {
                      setManualQuery(pendingConfirm.suggestedNames[0]);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition"
                >
                  <Search size={14} />
                  Manual Entry
                </button>
                <button
                  onClick={() => {
                    setPendingConfirm(null);
                    setScanPaused(false);
                  }}
                  className="rounded-lg border border-border bg-card-bg px-3 py-2.5 text-sm text-muted hover:text-foreground hover:bg-foreground/5 transition"
                >
                  <X size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual Search */}
      {showManualSearch && (
        <div className="mb-4 rounded-xl border border-border bg-card-bg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Search for a card</p>
            <button
              onClick={() => {
                setShowManualSearch(false);
                setManualQuery("");
                setManualResults([]);
                setScanPaused(false);
              }}
              className="p-1 text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type card name..."
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchCards(manualQuery)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition"
              autoFocus
            />
            <button
              onClick={() => searchCards(manualQuery)}
              disabled={searchingManual}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 transition"
            >
              {searchingManual ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </div>
          {manualResults.length > 0 && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {manualResults.map((card) => (
                <button
                  key={card.id}
                  onClick={() => addManualCard(card)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 hover:border-primary/30 transition text-left"
                >
                  <div className="relative h-12 w-9 flex-shrink-0 rounded overflow-hidden bg-background">
                    {card.thumbnailUrl || card.artUrl ? (
                      <Image
                        src={card.thumbnailUrl || card.artUrl!}
                        alt={card.name}
                        fill
                        className="object-cover"
                        sizes="36px"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{card.name}</p>
                    <p className="text-[11px] text-muted">
                      {card.type} &middot; {card.rarity}
                    </p>
                  </div>
                  <Plus size={16} className="text-primary flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Added Cards */}
      {detectedEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Added ({detectedEntries.reduce((sum, e) => sum + e.quantity, 0)})
            </h2>
            <button
              onClick={clearSession}
              className="text-xs text-muted hover:text-foreground transition"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1.5">
            {detectedEntries.map((entry) => (
              <div
                key={entry.card.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card-bg p-3"
              >
                <span className="text-sm font-semibold text-primary w-6 text-center flex-shrink-0">
                  {entry.quantity}x
                </span>
                <div className="relative h-12 w-9 flex-shrink-0 rounded overflow-hidden bg-background">
                  {entry.card.thumbnailUrl || entry.card.artUrl ? (
                    <Image
                      src={entry.card.thumbnailUrl || entry.card.artUrl!}
                      alt={entry.card.name}
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.card.name}</p>
                  <p className="text-[11px] text-muted">
                    {entry.card.type} &middot; {entry.card.rarity}
                  </p>
                </div>
                {addedCardIds.has(entry.card.id) && (
                  <div className="flex items-center gap-1 text-success text-xs">
                    <Check size={12} />
                    Added
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CameraPreview({
  videoRef,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationId: number;
    function draw() {
      const video = videoRef.current;
      const canvas = previewRef.current;
      if (video && canvas && video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(video, 0, 0);
      }
      animationId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [videoRef]);

  return <canvas ref={previewRef} className="w-full h-full object-cover" />;
}
