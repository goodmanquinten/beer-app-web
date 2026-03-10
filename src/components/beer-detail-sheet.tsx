"use client";

import type { Beer, BeerEntry } from "@/lib/types/database";
import StarRating from "./star-rating";

interface BeerDetailSheetProps {
  beer: Beer | null;
  entries: BeerEntry[];
  onDismiss: () => void;
  onLogAgain: (beer: Beer) => void;
  onDelete: (beer: Beer) => void;
}

export default function BeerDetailSheet({
  beer,
  entries,
  onDismiss,
  onLogAgain,
  onDelete,
}: BeerDetailSheetProps) {
  if (!beer) return null;

  // Compute stats
  const ratings = entries
    .map((e) => {
      const r = Array.isArray(e.rating) ? e.rating[0] : e.rating;
      return r?.score;
    })
    .filter((s): s is number => s != null);

  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  const totalTimes = entries.length;
  const lastHad = entries.length > 0
    ? new Date(entries[0].created_at).toLocaleDateString()
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: "rgba(0, 0, 0, 0.6)" }}
        onClick={onDismiss}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl max-w-lg mx-auto transition-transform duration-300 ease-out"
        style={{
          background: "linear-gradient(180deg, #2a1f12 0%, #1e1610 100%)",
          borderTop: "1px solid rgba(212, 165, 74, 0.15)",
          transform: "translateY(0)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(212, 165, 74, 0.25)" }} />
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Beer render + name */}
          <div className="flex items-start gap-4">
            <div className="w-20 h-24 flex-shrink-0 flex items-center justify-center">
              {beer.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={beer.image_url}
                  alt={beer.name}
                  className="w-full h-full object-contain"
                  style={{ filter: "drop-shadow(1px 3px 4px rgba(0,0,0,0.5))" }}
                />
              ) : (
                <div
                  className="w-14 h-20 rounded-sm flex items-center justify-center"
                  style={{
                    background: "linear-gradient(180deg, #c4873a 0%, #a06830 50%, #7a4f25 100%)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                  }}
                >
                  <span className="text-[9px] text-white font-bold text-center leading-tight px-1">
                    {beer.name.slice(0, 12)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate" style={{ color: "#f5e6d0" }}>
                {beer.name}
              </h2>
              <p className="text-sm" style={{ color: "rgba(212, 165, 74, 0.6)" }}>
                {beer.brewery}
              </p>
              <div className="flex gap-3 mt-1 text-sm" style={{ color: "rgba(212, 165, 74, 0.4)" }}>
                {beer.style && <span>{beer.style}</span>}
                {beer.abv && <span>{beer.abv}% ABV</span>}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: "rgba(74, 56, 35, 0.3)", border: "1px solid rgba(74, 56, 35, 0.3)" }}
            >
              <p className="text-xs" style={{ color: "rgba(212, 165, 74, 0.5)" }}>Rating</p>
              {avgRating != null ? (
                <div className="mt-1">
                  <StarRating score={Math.round(avgRating)} />
                  <p className="text-xs mt-0.5" style={{ color: "rgba(212, 165, 74, 0.6)" }}>{avgRating}</p>
                </div>
              ) : (
                <p className="text-sm mt-1" style={{ color: "rgba(212, 165, 74, 0.25)" }}>--</p>
              )}
            </div>
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: "rgba(74, 56, 35, 0.3)", border: "1px solid rgba(74, 56, 35, 0.3)" }}
            >
              <p className="text-xs" style={{ color: "rgba(212, 165, 74, 0.5)" }}>Times had</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#f5e6d0" }}>
                {totalTimes}
              </p>
            </div>
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: "rgba(74, 56, 35, 0.3)", border: "1px solid rgba(74, 56, 35, 0.3)" }}
            >
              <p className="text-xs" style={{ color: "rgba(212, 165, 74, 0.5)" }}>Last had</p>
              <p className="text-sm font-medium mt-2" style={{ color: "rgba(245, 230, 208, 0.8)" }}>
                {lastHad ?? "--"}
              </p>
            </div>
          </div>

          {/* Log Again button */}
          <button
            onClick={() => onLogAgain(beer)}
            className="w-full rounded-xl px-4 py-3 font-medium transition-colors"
            style={{
              background: "linear-gradient(180deg, #c4873a 0%, #a06830 100%)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(164, 106, 48, 0.3)",
            }}
          >
            Log Again
          </button>

          {/* Delete button */}
          <button
            onClick={() => onDelete(beer)}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              border: "1px solid rgba(220, 80, 60, 0.3)",
              color: "rgba(220, 100, 80, 0.8)",
              background: "transparent",
            }}
          >
            Remove from Shelf
          </button>
        </div>
      </div>
    </>
  );
}
