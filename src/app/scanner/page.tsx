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
  Pause,
  Play,
  Search,
  Plus,
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

interface PendingConfirmation {
  cards: IdentifiedCard[];
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
  const [autoScan, setAutoScan] = useState(false);
  const [error, setError] = useState("");

  const [detectedCards, setDetectedCards] = useState<IdentifiedCard[]>([]);
  const [addedCardIds, setAddedCardIds] = useState<Set<string>>(new Set());

  // Confirmation state
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);

  // Manual search state
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const [manualResults, setManualResults] = useState<IdentifiedCard[]>([]);
  const [searchingManual, setSearchingManual] = useState(false);

  const seenCardIdsRef = useRef<Set<string>>(new Set());
  const autoScanRef = useRef(false);
  const scanningRef = useRef(false);

  useEffect(() => {
    autoScanRef.current = autoScan;
  }, [autoScan]);
  useEffect(() => {
    scanningRef.current = scanning;
  }, [scanning]);

  // Auto-scan loop
  useEffect(() => {
    if (!autoScan || !cameraActive) return;
    scanFrame();
    const interval = setInterval(() => {
      if (autoScanRef.current && !scanningRef.current) {
        scanFrame();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [autoScan, cameraActive]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setAutoScan(false);
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

  async function confirmAndAddCards(cards: IdentifiedCard[]) {
    for (const card of cards) {
      if (seenCardIdsRef.current.has(card.id)) continue;
      seenCardIdsRef.current.add(card.id);
      try {
        await fetch("/api/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: card.id, quantity: 1 }),
        });
        setAddedCardIds((prev) => new Set(prev).add(card.id));
      } catch {
        // silently fail
      }
    }
    setDetectedCards((prev) => [
      ...cards.filter((c) => !prev.some((p) => p.id === c.id)),
      ...prev,
    ]);
    setPendingConfirm(null);
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
        if (autoScan) setAutoScan(false);
        const newCards = hasCards
          ? data.cards.filter((c: IdentifiedCard) => !seenCardIdsRef.current.has(c.id))
          : [];
        setPendingConfirm({
          cards: newCards,
          suggestions: hasSuggestions ? data.suggestions : undefined,
          suggestedNames: hasSuggestedNames ? data.suggestedNames : undefined,
        });
      } else if (!autoScan) {
        setError(data.message || "Could not identify any cards in the image.");
      }
    } catch {
      if (!autoScan) setError("Scan failed. Please try again.");
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
    await confirmAndAddCards([card]);
    setShowManualSearch(false);
    setManualQuery("");
    setManualResults([]);
  }

  function clearSession() {
    setDetectedCards([]);
    setAddedCardIds(new Set());
    seenCardIdsRef.current = new Set();
    setError("");
    setPendingConfirm(null);
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
        className={cameraActive ? "hidden" : "hidden"}
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

      {/* Live Camera View — mirrors the hidden video */}
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
              {autoScan && !scanning && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1.5">
                  <ScanLine size={12} className="text-success" />
                  <span className="text-[11px] text-white">Auto-scan on</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={stopCamera}
              className="flex-1 rounded-lg border border-border bg-card-bg py-3 text-sm font-medium hover:bg-foreground/5 transition"
            >
              Close Camera
            </button>
            <button
              onClick={() => setAutoScan(!autoScan)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition ${
                autoScan
                  ? "bg-success text-white hover:bg-success/90"
                  : "bg-primary text-white hover:bg-primary-hover"
              }`}
            >
              {autoScan ? (
                <>
                  <Pause size={14} />
                  Stop Scan
                </>
              ) : (
                <>
                  <Play size={14} />
                  Auto-scan
                </>
              )}
            </button>
          </div>

          {!autoScan && (
            <button
              onClick={scanFrame}
              disabled={scanning}
              className="w-full rounded-lg bg-primary/10 border border-primary/30 py-3 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition"
            >
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          )}
        </div>
      )}

      {/* Confirmation Panel */}
      {pendingConfirm && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          {/* Exact matches */}
          {pendingConfirm.cards.length > 0 && (
            <>
              <p className="text-sm font-semibold">
                Found {pendingConfirm.cards.length} card{pendingConfirm.cards.length > 1 ? "s" : ""}
              </p>
              <div className="space-y-1.5">
                {pendingConfirm.cards.map((card) => (
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
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => confirmAndAddCards(pendingConfirm.cards)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition"
                >
                  <Check size={14} />
                  Add to Collection
                </button>
                <button
                  onClick={() => {
                    setPendingConfirm(null);
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
          {pendingConfirm.cards.length === 0 && pendingConfirm.suggestions && pendingConfirm.suggestions.length > 0 && (
            <>
              <p className="text-sm font-semibold">
                Best guesses{pendingConfirm.suggestedNames ? ` for "${pendingConfirm.suggestedNames.join(", ")}"` : ""}
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
                      onClick={() => confirmAndAddCards([card])}
                      className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover transition flex-shrink-0"
                    >
                      <Plus size={12} />
                      Add
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPendingConfirm(null);
                    setShowManualSearch(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-card-bg py-2.5 text-sm font-medium hover:bg-foreground/5 transition"
                >
                  <Search size={14} />
                  Manual Entry
                </button>
                <button
                  onClick={() => setPendingConfirm(null)}
                  className="rounded-lg border border-border bg-card-bg px-3 py-2.5 text-sm text-muted hover:text-foreground hover:bg-foreground/5 transition"
                >
                  <X size={14} />
                </button>
              </div>
            </>
          )}

          {/* No matches and no suggestions */}
          {pendingConfirm.cards.length === 0 && (!pendingConfirm.suggestions || pendingConfirm.suggestions.length === 0) && (
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
                  onClick={() => setPendingConfirm(null)}
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

      {/* Detected Cards */}
      {detectedCards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Detected Cards ({detectedCards.length})
            </h2>
            <button
              onClick={clearSession}
              className="text-xs text-muted hover:text-foreground transition"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1.5">
            {detectedCards.map((card) => (
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
                {addedCardIds.has(card.id) && (
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

// Renders the camera stream onto a visible canvas, mirroring the hidden video
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
