"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Beer, BeerEntry } from "@/lib/types/database";
import BeerShelf from "@/components/beer-shelf";
import BeerDetailSheet from "@/components/beer-detail-sheet";
import ScanFab from "@/components/scan-fab";
import NewBeerOverlay from "@/components/new-beer-overlay";
import { searchBeers, createBeerFromOCR, searchBeersByTerms } from "@/actions/beers";
import {
  createEntry,
  addRating,
  removeBeerFromShelf,
  getBeerRatings,
  updateShelfArrangement,
} from "@/actions/entries";

interface ShelfViewProps {
  entries: BeerEntry[];
  shelfBeerIds: string[];
}

type OverlayState = null | "processing" | "rating";
type RenderNotice =
  | { kind: "info"; message: string }
  | { kind: "error"; message: string }
  | null;

type IdentifyResponse = {
  name: string;
  brewery: string;
  style: string;
  containerType: Beer["container_type"];
  searchTerms?: string[];
};

type OcrHints = {
  text: string;
  terms: string[];
};

function normalizeBeerText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildSearchTerms(...values: Array<string | null | undefined>) {
  const terms = values
    .flatMap((value) =>
      normalizeBeerText(value)
        .split(" ")
        .map((part) => part.trim())
        .filter((part) => part.length >= 3)
    );

  return Array.from(new Set(terms));
}

function scoreBeerMatch(
  beer: Beer,
  name: string,
  brewery: string,
  searchTerms: string[]
) {
  const beerName = normalizeBeerText(beer.name);
  const beerBrewery = normalizeBeerText(beer.brewery);
  const normalizedName = normalizeBeerText(name);
  const normalizedBrewery = normalizeBeerText(brewery);

  let score = 0;

  if (normalizedName && beerName === normalizedName) score += 100;
  else if (normalizedName && beerName.includes(normalizedName)) score += 40;

  if (normalizedBrewery && beerBrewery === normalizedBrewery) score += 60;
  else if (normalizedBrewery && beerBrewery.includes(normalizedBrewery)) score += 20;

  for (const term of searchTerms) {
    if (beerName.includes(term)) score += 10;
    if (beerBrewery.includes(term)) score += 6;
  }

  return score;
}

function findBestBeerMatch(
  beers: Beer[],
  name: string,
  brewery: string,
  searchTerms: string[]
) {
  let bestMatch: Beer | null = null;
  let bestScore = 0;

  for (const beer of beers) {
    const score = scoreBeerMatch(beer, name, brewery, searchTerms);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = beer;
    }
  }

  return bestScore >= 40 ? bestMatch : null;
}

async function extractOcrHints(imageDataUrl: string): Promise<OcrHints> {
  try {
    const { extractTextFromImage, extractSearchTerms } = await import("@/lib/ocr-service");
    const result = await extractTextFromImage(imageDataUrl);
    return {
      text: result.rawText,
      terms: extractSearchTerms(result.lines),
    };
  } catch {
    return { text: "", terms: [] };
  }
}

export default function ShelfView({ entries, shelfBeerIds }: ShelfViewProps) {
  const router = useRouter();
  const [selectedBeer, setSelectedBeer] = useState<Beer | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<BeerEntry[]>([]);
  const [beerRatings, setBeerRatings] = useState<{
    globalAvg: number | null;
    friendsAvg: number | null;
    personalRating: { entryId: string; score: number } | null;
  } | null>(null);
  const [arrangement, setArrangement] = useState<string[]>(shelfBeerIds);
  const scanFabRef = useRef<{ trigger: () => void }>(null);
  const saveCounterRef = useRef(0);

  const [overlayState, setOverlayState] = useState<OverlayState>(null);
  const [scannedBeer, setScannedBeer] = useState<Beer | null>(null);
  const [scannedEntryId, setScannedEntryId] = useState<string | null>(null);
  const [renderNotice, setRenderNotice] = useState<RenderNotice>(null);
  const renderPromiseRef = useRef<Promise<{ notice: RenderNotice }> | null>(null);

  useEffect(() => {
    setArrangement(shelfBeerIds);
  }, [shelfBeerIds]);

  const handleArrangementChange = useCallback(async (beerIds: string[]) => {
    const id = ++saveCounterRef.current;
    setArrangement(beerIds);

    const result = await updateShelfArrangement(beerIds);

    // Ignore stale responses from earlier drags
    if (id !== saveCounterRef.current) return;

    if (result.error) {
      if (typeof window !== "undefined") {
        window.alert(result.error);
      }
      return;
    }

    if (result.data) {
      setArrangement(result.data);
    }
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
    setRenderNotice(null);

    try {
      const dataUrl = await fileToDataUrl(file);
      const ocrHints = await extractOcrHints(dataUrl);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let identifyResult: IdentifyResponse | null = null;
      let identifyError: string | null = null;

      try {
        const idResponse = await fetch("/api/identify-beer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: dataUrl,
            ocrText: ocrHints.text,
            ocrTerms: ocrHints.terms,
          }),
          signal: controller.signal,
        });

        const body = await idResponse.json().catch(() => ({}));
        if (idResponse.ok) {
          identifyResult = body as IdentifyResponse;
        } else {
          identifyError = typeof body.error === "string" ? body.error : null;
        }
      } finally {
        clearTimeout(timeout);
      }

      const identifiedName = identifyResult?.name ?? "";
      const identifiedBrewery = identifyResult?.brewery ?? "";
      const identifiedStyle = identifyResult?.style ?? "Beer";
      const containerType = identifyResult?.containerType ?? "can";
      const searchTerms = Array.from(
        new Set([
          ...buildSearchTerms(identifiedName, identifiedBrewery, identifiedStyle),
          ...(identifyResult?.searchTerms ?? []).map((term) => normalizeBeerText(term)),
          ...ocrHints.terms.map((term) => normalizeBeerText(term)),
        ].filter((term) => term.length >= 3))
      );

      let beer: Beer | null = null;

      if (identifiedName) {
        const directSearchResult = await searchBeers(identifiedName, {
          brewery: identifiedBrewery || undefined,
          containerType,
        });

        if (directSearchResult.error) {
          if (typeof window !== "undefined") {
            window.alert(directSearchResult.error);
          }
          setOverlayState(null);
          return;
        }

        if (directSearchResult.data) {
          beer = findBestBeerMatch(
            directSearchResult.data,
            identifiedName,
            identifiedBrewery,
            searchTerms
          );
        }
      }

      if (!beer && searchTerms.length > 0) {
        const termSearchResult = await searchBeersByTerms(searchTerms, { containerType });
        if (termSearchResult.error) {
          if (typeof window !== "undefined") {
            window.alert(termSearchResult.error);
          }
          setOverlayState(null);
          return;
        }

        if (termSearchResult.data) {
          beer = findBestBeerMatch(
            termSearchResult.data,
            identifiedName,
            identifiedBrewery,
            searchTerms
          );
        }
      }

      if (!beer) {
        if (!identifiedName || identifiedName === "Unknown Beer") {
          if (typeof window !== "undefined") {
            const msg = identifyError
              ? `Could not identify beer: ${identifyError}`
              : "Could not identify this beer well enough to add it. Try a tighter photo of the label.";
            window.alert(msg);
          }
          setOverlayState(null);
          return;
        }

        const createResult = await createBeerFromOCR(
          identifiedName,
          identifiedBrewery || "Unknown Brewery",
          identifiedStyle,
          containerType
        );

        if (createResult.error || !createResult.data) {
          if (createResult.error && typeof window !== "undefined") {
            window.alert(createResult.error);
          }
          setOverlayState(null);
          return;
        }

        beer = createResult.data;
      }

      if (!beer) { setOverlayState(null); return; }

      const entryResult = await createEntry(beer.id);
      if (entryResult.error || !entryResult.data) {
        if (entryResult.error && typeof window !== "undefined") {
          window.alert(entryResult.error);
        }
        setOverlayState(null);
        return;
      }

      renderPromiseRef.current = fetch("/api/generate-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beerId: beer.id,
          imageDataUrl: dataUrl,
          containerType: beer.container_type,
          beerName: beer.name,
        }),
      })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) {
            const message =
              typeof body.error === "string"
                ? body.error
                : `Render generation failed (${r.status})`;
            const notice = { kind: "error" as const, message };
            setRenderNotice(notice);
            if (typeof window !== "undefined") {
              window.alert(`Beer added, but the render failed: ${message}`);
            }
            return { notice };
          }
          router.refresh();
          return { notice: null };
        })
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : "Render request failed";

          if (message.includes("Failed to fetch")) {
            const notice = {
              kind: "info" as const,
              message: "Beer added. The can render is still processing and should appear shortly.",
            };
            setRenderNotice(notice);
            if (typeof window !== "undefined") {
              window.setTimeout(() => { router.refresh(); }, 5000);
              window.setTimeout(() => { router.refresh(); }, 15000);
              window.setTimeout(() => { router.refresh(); }, 30000);
            }
            return { notice };
          }

          const notice = { kind: "error" as const, message };
          setRenderNotice(notice);
          if (typeof window !== "undefined") {
            window.alert(`Beer added, but the render failed: ${message}`);
          }
          return { notice };
        });

      setScannedBeer({ ...beer, image_url: null });
      setScannedEntryId(entryResult.data.id);
      setOverlayState("rating");
      router.refresh();
    } catch (err) {
      if (typeof window !== "undefined") {
        window.alert(
          err instanceof Error ? err.message : "Scan failed. Try again with a clearer photo."
        );
      }
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
      {renderNotice && (
        <div
          className="mx-3 mb-3 rounded-xl px-4 py-3 text-sm"
          style={{
            background:
              renderNotice.kind === "error"
                ? "rgba(120, 36, 24, 0.85)"
                : "rgba(40, 64, 28, 0.85)",
            border:
              renderNotice.kind === "error"
                ? "1px solid rgba(220, 100, 80, 0.35)"
                : "1px solid rgba(126, 180, 90, 0.35)",
            color: "#f5e6d0",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <p>
              {renderNotice.kind === "error"
                ? `Beer added, but the can render failed: ${renderNotice.message}`
                : renderNotice.message}
            </p>
            <button
              onClick={() => setRenderNotice(null)}
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
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not process image"));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };

    image.src = objectUrl;
  });
}
