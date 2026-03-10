"use client";

import { useState } from "react";

export default function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (score: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className={`text-2xl ${
            star <= (hovered || value) ? "text-amber-500" : "text-gray-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
