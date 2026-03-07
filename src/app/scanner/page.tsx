"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Check, X, Loader2, RotateCcw } from "lucide-react";
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

interface ScanResult {
  identified: boolean;
  card?: IdentifiedCard;
  suggestedName?: string;
  message?: string;
}

export default function ScannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState("");

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
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
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        setImageFile(file);
        setPreview(URL.createObjectURL(blob));
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setAdded(false);
    setError("");
  }

  async function scanCard() {
    if (!imageFile) return;
    setScanning(true);
    setResult(null);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const res = await fetch("/api/scan", { method: "POST", body: formData });
      const data: ScanResult = await res.json();
      setResult(data);
    } catch {
      setError("Scan failed. Please try again.");
    }
    setScanning(false);
  }

  async function addToCollection() {
    if (!result?.card) return;
    setAdding(true);
    try {
      await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: result.card.id, quantity: 1 }),
      });
      setAdded(true);
    } catch {
      setError("Failed to add card to collection.");
    }
    setAdding(false);
  }

  function reset() {
    setPreview(null);
    setImageFile(null);
    setResult(null);
    setAdded(false);
    setError("");
    stopCamera();
  }

  return (
    <div className="px-4 py-4 md:px-8 md:py-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold md:text-2xl">Scan Card</h1>
        <p className="text-sm text-muted mt-0.5">
          Take a photo or upload an image to identify a card
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Camera / Upload area */}
      {!preview && !cameraActive && (
        <div className="space-y-3">
          <button
            onClick={startCamera}
            className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card-bg p-10 hover:border-primary/50 transition"
          >
            <Camera size={24} className="text-primary" />
            <span className="text-sm font-medium">Open Camera</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card-bg p-10 hover:border-primary/50 transition"
          >
            <Upload size={24} className="text-primary" />
            <span className="text-sm font-medium">Upload Image</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Camera view */}
      {cameraActive && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 border-2 border-white/20 rounded-xl pointer-events-none" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={stopCamera}
              className="flex-1 rounded-lg border border-border bg-card-bg py-3 text-sm font-medium hover:bg-foreground/5 transition"
            >
              Cancel
            </button>
            <button
              onClick={capturePhoto}
              className="flex-1 rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-hover transition"
            >
              Capture
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Preview + Scan */}
      {preview && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4]">
            <Image src={preview} alt="Card preview" fill className="object-contain" sizes="400px" />
          </div>

          {!result && !scanning && (
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 rounded-lg border border-border bg-card-bg py-3 text-sm font-medium hover:bg-foreground/5 transition"
              >
                Retake
              </button>
              <button
                onClick={scanCard}
                className="flex-1 rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-hover transition"
              >
                Identify Card
              </button>
            </div>
          )}

          {scanning && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 size={20} className="animate-spin text-primary" />
              <span className="text-sm text-muted">Identifying card...</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-xl border border-border bg-card-bg p-4 space-y-3">
              {result.identified && result.card ? (
                <>
                  <div className="flex items-center gap-2">
                    <Check size={18} className="text-success" />
                    <span className="text-sm font-semibold">Card Identified!</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-12 rounded overflow-hidden bg-background flex-shrink-0">
                      {result.card.thumbnailUrl ? (
                        <Image
                          src={result.card.thumbnailUrl}
                          alt={result.card.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{result.card.name}</p>
                      <p className="text-xs text-muted">
                        {result.card.type} &middot; {result.card.rarity}
                      </p>
                    </div>
                  </div>
                  {added ? (
                    <div className="flex items-center gap-2 text-success text-sm">
                      <Check size={16} />
                      Added to collection!
                    </div>
                  ) : (
                    <button
                      onClick={addToCollection}
                      disabled={adding}
                      className="w-full rounded-lg bg-success py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50 transition"
                    >
                      {adding ? "Adding..." : "Add to Collection"}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <X size={18} className="text-danger" />
                    <span className="text-sm font-semibold">Could not identify</span>
                  </div>
                  <p className="text-xs text-muted">
                    {result.suggestedName
                      ? `Best guess: "${result.suggestedName}" — but no exact match found.`
                      : result.message || "Try a clearer photo."}
                  </p>
                </>
              )}
              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-border py-2.5 text-sm hover:bg-foreground/5 transition"
              >
                <RotateCcw size={14} />
                Scan Another Card
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
