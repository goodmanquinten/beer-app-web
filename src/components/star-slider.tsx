"use client";

import { useRef, useState, useCallback } from "react";

interface StarSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function StarSlider({ value, onChange }: StarSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const computeValue = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return value;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      // Round to nearest 0.1
      return Math.round(ratio * 50) / 10;
    },
    [value]
  );

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onChange(computeValue(e.clientX));
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    onChange(computeValue(e.clientX));
  }

  function handlePointerUp() {
    setDragging(false);
  }

  return (
    <div className="flex flex-col items-center gap-2 select-none touch-none">
      <div
        ref={containerRef}
        className="relative flex cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, value - i));
          return (
            <div key={i} className="relative w-12 h-12 mx-0.5">
              {/* Empty star */}
              <svg
                viewBox="0 0 24 24"
                className="absolute inset-0 w-full h-full text-gray-300 drop-shadow-md"
                fill="currentColor"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {/* Filled star with clip */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-12 h-12 text-amber-400 drop-shadow-lg"
                  fill="currentColor"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
      <span className="text-2xl font-bold text-amber-500 tabular-nums">
        {value.toFixed(1)}
      </span>
    </div>
  );
}
