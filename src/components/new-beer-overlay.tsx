"use client";

import { useState } from "react";
import type { Beer } from "@/lib/types/database";
import StarSlider from "@/components/star-slider";

interface NewBeerOverlayProps {
  state: "processing" | "rating";
  beer: Beer | null;
  onSubmit: (rating: number) => void | Promise<void>;
  onDismiss: () => void;
}

export default function NewBeerOverlay({
  state,
  beer,
  onSubmit,
  onDismiss,
}: NewBeerOverlayProps) {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    await onSubmit(rating);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {state === "processing" && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          <p className="text-lg font-medium text-white">Identifying beer...</p>
        </div>
      )}

      {state === "rating" && beer && (
        <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl bg-gray-900/90 p-6 shadow-2xl">
          {/* Beer image */}
          {beer.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={beer.image_url}
              alt={beer.name}
              className="h-48 w-auto object-contain drop-shadow-xl"
            />
          ) : (
            <div className="flex h-48 w-32 items-center justify-center rounded-2xl bg-gray-700 text-4xl">
              🍺
            </div>
          )}

          {/* Beer name */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">{beer.name}</h2>
            {beer.brewery && (
              <p className="text-sm text-gray-400">{beer.brewery}</p>
            )}
          </div>

          {/* Star slider */}
          <StarSlider value={rating} onChange={setRating} />

          {/* Actions */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-2xl bg-amber-500 px-6 py-3 text-lg font-bold text-white shadow-lg hover:bg-amber-600 active:bg-amber-700 transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-3">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Adding...
              </span>
            ) : (
              "Add to Shelf"
            )}
          </button>
          {!submitting && (
            <button
              onClick={onDismiss}
              className="text-sm text-gray-400 hover:text-gray-200"
            >
              Skip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
