"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Beer, BeerEntry } from "@/lib/types/database";
import BeerShelf from "@/components/beer-shelf";
import BeerDetailSheet from "@/components/beer-detail-sheet";
import ScanFab from "@/components/scan-fab";
import NewBeerOverlay from "@/components/new-beer-overlay";
import { searchBeers, createBeerFromOCR } from "@/actions/beers";
import { createEntry, addRating, removeBeerFromShelf, getBeerRatings } from "@/actions/entries";

interface ShelfViewProps {
  entries: BeerEntry[];
}

type OverlayState = null | "processing" | "rating";

/** localStorage key for manual arrangement */
const ARRANGEMENT_KEY = "beer-shelf-arrangement";

function loadArrangement(): string[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = localStorage.getItem(ARRANGEMENT_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return undefined;
}

function saveArrangement(ids: string[]) {
  try {
    localStorage.setItem(ARRANGEMENT_KEY, JSON.stringify(ids));
  } catch {}
}

export default function ShelfView({ entries }: ShelfViewProps) {
  const router = useRouter();
  const [selectedBeer, setSelectedBeer] = useState<Beer | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<BeerEntry[]>([]);
  const [beerRatings, setBeerRatings] = useState<{
    globalAvg: number | null;
    friendsAvg: number | null;
    personalRating: { entryId: string; score: number } | null;
  } | null>(null);
  const [arrangement, setArrangement] = useState<string[] | undefined>(
    loadArrangement
  );
  const scanFabRef = useRef<{ trigger: () => void }>(null);

  // Scan-to-rate state
  const [overlayState, setOverlayState] = useState<OverlayState>(null);
  const [scannedBeer, setScannedBeer] = useState<Beer | null>(null);
  const [scannedEntryId, setScannedEntryId] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const renderPromiseRef = useRef<Promise<{ error: string | null }> | null>(null);

  const handleArrangementChange = useCallback((beerIds: string[]) => {
    setArrangement(beerIds);
    saveArrangement(beerIds);
  }, []);

  function handleSelectBeer(beer: Beer, beerEntries: BeerEntry[]) {
    setSelectedBeer(beer);
    setSelectedEntries(beerEntries);
    setBeerRatings(null);
    getBeerRatings(beer.id).then((result) => {
      if (result.data) setBeerRatings(result.data);
    });
  }

  function handleDismiss() {
    setSelectedBeer(null);
    setSelectedEntries([]);
    setBeerRatings(null);
  }

  async function handleRatingChange(entryId: string, score: number) {
    await addRating(entryId, score);
    // Refresh ratings
    if (selectedBeer) {
      const result = await getBeerRatings(selectedBeer.id);
      if (result.data) setBeerRatings(result.data);
    }
  }

  async function handleLogAgain(beer: Beer) {
    await createEntry(beer.id);
    handleDismiss();
    router.refresh();
  }

  async function handleDelete(beer: Beer) {
    await removeBeerFromShelf(beer.id);
    handleDismiss();
    router.refresh();
  }

  async function handleImageCaptured(file: File) {
    setOverlayState("processing");
    setRenderError(null);

    const dataUrl = await fileToDataUrl(file);

    try {
      // 1. AI-identify the beer from the photo
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let idResponse: Response;
      try {
        idResponse = await fetch("/api/identify-beer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: dataUrl }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!idResponse.ok) {
        console.error("identify-beer failed:", idResponse.status);
        setOverlayState(null);
        return;
      }

      const { name, brewery } = await idResponse.json();

      // 2. Search DB for existing match
      let beer: Beer;
      const searchResult = await searchBeers(name);

      if (searchResult.data && searchResult.data.length > 0) {
        beer = searchResult.data[0];
      } else {
        const createResult = await createBeerFromOCR(name, brewery);
        if (createResult.error || !createResult.data) {
          setOverlayState(null);
          return;
        }
        beer = createResult.data;
      }

      // 3. Create entry
      const entryResult = await createEntry(beer.id);
      if (entryResult.error || !entryResult.data) {
        setOverlayState(null);
        return;
      }

      // 4. Start render generation if no image yet
      if (!beer.image_url) {
        renderPromiseRef.current = fetch("/api/generate-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            beerId: beer.id,
            imageDataUrl: dataUrl,
            containerType: "can",
          }),
        })
          .then(async (r) => {
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
              const message =
                typeof body.error === "string"
                  ? body.error
                  : `Render generation failed (${r.status})`;
              setRenderError(message);
              if (typeof window !== "undefined") {
                window.alert(`Beer added, but the render failed: ${message}`);
              }
              return { error: message };
            }
            return { error: null };
          })
          .catch((err) => {
            const message =
              err instanceof Error ? err.message : "Render request failed";
            setRenderError(message);
            if (typeof window !== "undefined") {
              window.alert(`Beer added, but the render failed: ${message}`);
            }
            return { error: message };
          });
      }

      // 5. Show rating overlay
      setScannedBeer(beer);
      setScannedEntryId(entryResult.data.id);
      setOverlayState("rating");
    } catch (err) {
      console.error("Scan flow error:", err);
      setOverlayState(null);
    }
  }

  async function handleRatingSubmit(score: number) {
    if (score > 0 && scannedEntryId) {
      await addRating(scannedEntryId, score);
    }
    const pendingRender = renderPromiseRef.current;
    resetOverlay();
    router.refresh();

    if (pendingRender) {
      pendingRender.then(() => router.refresh());
    }
  }

  function resetOverlay() {
    setOverlayState(null);
    setScannedBeer(null);
    setScannedEntryId(null);
    renderPromiseRef.current = null;
  }

  if (entries.length === 0) {
    return (
      <>
        <div className="px-4 pt-6 text-center">
          <p className="text-lg mb-2" style={{ color: "var(--gold-accent)", opacity: 0.7 }}>
            Your shelf is empty
          </p>
          <p className="text-sm" style={{ color: "var(--gold-dim)", opacity: 0.5 }}>
            Scan your first beer to get started
          </p>
        </div>
        <div className="mt-4 opacity-40">
          <BeerShelf entries={[]} onSelectBeer={() => {}} />
        </div>
        <ScanFab onImageCaptured={handleImageCaptured} triggerRef={scanFabRef} />
        {overlayState && (
          <NewBeerOverlay
            state={overlayState}
            beer={scannedBeer}
            onSubmit={handleRatingSubmit}
            onDismiss={resetOverlay}
          />
        )}
      </>
    );
  }

  return (
    <>
      {renderError && (
        <div
          className="mx-3 mb-3 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(120, 36, 24, 0.85)",
            border: "1px solid rgba(220, 100, 80, 0.35)",
            color: "#f5e6d0",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <p>Beer added, but the can render failed: {renderError}</p>
            <button
              onClick={() => setRenderError(null)}
              className="shrink-0 text-xs"
              style={{ color: "rgba(245, 230, 208, 0.7)" }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <BeerShelf
        entries={entries}
        onSelectBeer={handleSelectBeer}
        arrangement={arrangement}
        onArrangementChange={handleArrangementChange}
        onAddBeer={() => scanFabRef.current?.trigger()}
      />
      <ScanFab onImageCaptured={handleImageCaptured} triggerRef={scanFabRef} />
      {selectedBeer && (
        <BeerDetailSheet
          key={`${selectedBeer.id}:${selectedBeer.image_url ?? "no-image"}:${beerRatings?.personalRating?.score ?? "no-rating"}`}
          beer={selectedBeer}
          entries={selectedEntries}
          ratings={beerRatings}
          onDismiss={handleDismiss}
          onLogAgain={handleLogAgain}
          onDelete={handleDelete}
          onRatingChange={handleRatingChange}
        />
      )}
      {overlayState && (
        <NewBeerOverlay
          state={overlayState}
          beer={scannedBeer}
          onSubmit={handleRatingSubmit}
          onDismiss={resetOverlay}
        />
      )}
    </>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
