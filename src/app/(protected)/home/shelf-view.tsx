"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Beer, BeerEntry } from "@/lib/types/database";
import BeerShelf from "@/components/beer-shelf";
import BeerDetailSheet from "@/components/beer-detail-sheet";
import ScanFab from "@/components/scan-fab";
import NewBeerOverlay from "@/components/new-beer-overlay";
import { searchBeers, createBeerFromOCR } from "@/actions/beers";
import { createEntry, addRating, removeBeerFromShelf } from "@/actions/entries";

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
  const [arrangement, setArrangement] = useState<string[] | undefined>(
    loadArrangement
  );

  // Scan-to-rate state
  const [overlayState, setOverlayState] = useState<OverlayState>(null);
  const [scannedBeer, setScannedBeer] = useState<Beer | null>(null);
  const [scannedEntryId, setScannedEntryId] = useState<string | null>(null);
  const renderPromiseRef = useRef<Promise<void> | null>(null);

  const handleArrangementChange = useCallback((beerIds: string[]) => {
    setArrangement(beerIds);
    saveArrangement(beerIds);
  }, []);

  function handleSelectBeer(beer: Beer, beerEntries: BeerEntry[]) {
    setSelectedBeer(beer);
    setSelectedEntries(beerEntries);
  }

  function handleDismiss() {
    setSelectedBeer(null);
    setSelectedEntries([]);
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

      const { name, brewery, style } = await idResponse.json();

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
            const j = await r.json();
            console.log("Render result:", j);
          })
          .catch((err) => console.error("Render fetch error:", err));
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
        <ScanFab onImageCaptured={handleImageCaptured} />
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
      <BeerShelf
        entries={entries}
        onSelectBeer={handleSelectBeer}
        arrangement={arrangement}
        onArrangementChange={handleArrangementChange}
      />
      <ScanFab onImageCaptured={handleImageCaptured} />
      {selectedBeer && (
        <BeerDetailSheet
          beer={selectedBeer}
          entries={selectedEntries}
          onDismiss={handleDismiss}
          onLogAgain={handleLogAgain}
          onDelete={handleDelete}
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
