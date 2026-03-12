"use client";

import { useState, useEffect } from "react";
import type { Beer, BeerEntry } from "@/lib/types/database";
import StarRating from "./star-rating";
import StarSlider from "./star-slider";

interface BeerRatings {
  globalAvg: number | null;
  friendsAvg: number | null;
  personalRating: { entryId: string; score: number } | null;
}

interface BeerDetailSheetProps {
  beer: Beer | null;
  entries: BeerEntry[];
  ratings: BeerRatings | null;
  onDismiss: () => void;
  onLogAgain: (beer: Beer) => void;
  onDelete: (beer: Beer) => void;
  onRatingChange: (entryId: string, score: number) => void;
}

export default function BeerDetailSheet({
  beer,
  entries,
  ratings,
  onDismiss,
  onLogAgain,
  onDelete,
  onRatingChange,
}: BeerDetailSheetProps) {
  const [personalScore, setPersonalScore] = useState(0);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const initialScore = ratings?.personalRating?.score ?? 0;

  // Probe render URLs with JS Image()
  useEffect(() => {
    if (!beer) return;
    let cancelled = false;
    const localSrc = `/renders/${beer.id}.png`;
    const apiSrc = `/api/renders?id=${beer.id}`;
    const candidates = [
      beer.image_url,
      localSrc,
      apiSrc,
    ].filter((src): src is string => Boolean(src));

    const tryLoad = (index: number) => {
      if (index >= candidates.length) return;
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setImgSrc(candidates[index]);
      };
      img.onerror = () => {
        tryLoad(index + 1);
      };
      img.src = candidates[index];
    };

    tryLoad(0);
    return () => { cancelled = true; };
  }, [beer]);

  if (!beer) return null;

  const totalTimes = entries.length;
  const lastHad =
    entries.length > 0
      ? new Date(entries[0].created_at).toLocaleDateString()
      : null;

  function handleRatingChange(score: number) {
    setPersonalScore(score);
    const entryId = ratings?.personalRating?.entryId ?? entries[0]?.id;
    if (entryId) {
      onRatingChange(entryId, score);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)" }}
        onClick={onDismiss}
      />

      {/* Sheet — centered */}
      <div
        className="fixed z-50 left-4 right-4 max-w-md mx-auto rounded-2xl shadow-2xl overflow-hidden"
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          background: "linear-gradient(180deg, #2a1f12 0%, #1e1610 100%)",
          border: "1px solid rgba(212, 165, 74, 0.12)",
        }}
      >
        <div className="flex p-5 gap-5">
          {/* Left: Can render (~40%) */}
          <div className="w-[38%] flex-shrink-0 flex items-center justify-center">
            {imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc}
                alt={beer.name}
                className="w-full h-auto object-contain max-h-56"
              />
            ) : (
              <div
                className="w-20 h-28 rounded-sm flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(180deg, #c4873a 0%, #a06830 50%, #7a4f25 100%)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                }}
              >
                <span className="text-[10px] text-white font-bold text-center leading-tight px-1">
                  {beer.name.slice(0, 14)}
                </span>
              </div>
            )}
          </div>

          {/* Right: Info (~60%) */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* Name / brewery / style */}
            <div>
              <h2
                className="text-lg font-bold leading-tight"
                style={{ color: "#f5e6d0" }}
              >
                {beer.name}
              </h2>
              <p className="text-sm" style={{ color: "rgba(212, 165, 74, 0.6)" }}>
                {beer.brewery}
              </p>
              <div
                className="flex gap-2 mt-0.5 text-xs"
                style={{ color: "rgba(212, 165, 74, 0.4)" }}
              >
                {beer.style && <span>{beer.style}</span>}
                {beer.abv && <span>{beer.abv}% ABV</span>}
              </div>
            </div>

            {/* Your Rating — interactive slider with decimals */}
            <div>
              <p
                className="text-[11px] uppercase tracking-wide mb-1 font-medium"
                style={{ color: "rgba(212, 165, 74, 0.5)" }}
              >
                Your Rating
              </p>
              <div className="scale-[0.6] origin-top-left -mb-6">
                <StarSlider value={personalScore || initialScore} onChange={handleRatingChange} />
              </div>
            </div>

            {/* Global & Friends ratings */}
            <div className="flex gap-4">
              <div>
                <p
                  className="text-[11px] uppercase tracking-wide mb-0.5 font-medium"
                  style={{ color: "rgba(212, 165, 74, 0.5)" }}
                >
                  Global
                </p>
                {ratings?.globalAvg != null ? (
                  <div className="flex items-center gap-1.5">
                    <StarRating score={Math.round(ratings.globalAvg)} />
                    <span
                      className="text-xs font-medium"
                      style={{ color: "rgba(245, 230, 208, 0.7)" }}
                    >
                      {ratings.globalAvg}
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-sm"
                    style={{ color: "rgba(212, 165, 74, 0.25)" }}
                  >
                    --
                  </span>
                )}
              </div>
              <div>
                <p
                  className="text-[11px] uppercase tracking-wide mb-0.5 font-medium"
                  style={{ color: "rgba(212, 165, 74, 0.5)" }}
                >
                  Friends
                </p>
                {ratings?.friendsAvg != null ? (
                  <div className="flex items-center gap-1.5">
                    <StarRating score={Math.round(ratings.friendsAvg)} />
                    <span
                      className="text-xs font-medium"
                      style={{ color: "rgba(245, 230, 208, 0.7)" }}
                    >
                      {ratings.friendsAvg}
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-sm"
                    style={{ color: "rgba(212, 165, 74, 0.25)" }}
                  >
                    --
                  </span>
                )}
              </div>
            </div>

            {/* Times had / Last had */}
            <div className="flex gap-4 text-sm">
              <div>
                <span style={{ color: "rgba(212, 165, 74, 0.5)" }}>Times had </span>
                <span className="font-bold" style={{ color: "#f5e6d0" }}>
                  {totalTimes}
                </span>
              </div>
              <div>
                <span style={{ color: "rgba(212, 165, 74, 0.5)" }}>Last </span>
                <span
                  className="font-medium"
                  style={{ color: "rgba(245, 230, 208, 0.8)" }}
                >
                  {lastHad ?? "--"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom buttons */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={() => onLogAgain(beer)}
            className="flex-1 rounded-xl px-4 py-2.5 font-medium transition-colors text-sm"
            style={{
              background: "linear-gradient(180deg, #c4873a 0%, #a06830 100%)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(164, 106, 48, 0.3)",
            }}
          >
            Log Again
          </button>
          <button
            onClick={() => onDelete(beer)}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              border: "1px solid rgba(220, 80, 60, 0.3)",
              color: "rgba(220, 100, 80, 0.8)",
              background: "transparent",
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </>
  );
}
