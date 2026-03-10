import { getUserEntries } from "@/actions/entries";
import Link from "next/link";
import ShelfView from "./shelf-view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data: entries, error } = await getUserEntries();
  const uniqueCount = new Set((entries ?? []).map((e) => e.beer_id)).size;

  return (
    <div className="shelf-backdrop">
      <div className="max-w-lg mx-auto min-h-dvh px-3 py-4">
        {/* Header */}
        <div className="flex items-center justify-between px-1 pb-3">
          <div>
            <h1 className="shelf-title text-2xl font-bold leading-tight">
              My Shelf
            </h1>
            {uniqueCount > 0 && (
              <p
                className="text-[11px] tracking-wide mt-0.5"
                style={{ color: "rgba(212, 165, 74, 0.35)" }}
              >
                {uniqueCount} {uniqueCount === 1 ? "beer" : "beers"} collected
              </p>
            )}
          </div>
          <Link
            href="/profile"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: "rgba(212, 165, 74, 0.1)",
              color: "var(--gold-accent)",
            }}
            aria-label="Profile"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>

        {/* Cabinet */}
        <div className="cabinet-frame p-3 pb-4">
          {error && (
            <p className="text-red-400 text-sm px-2 pb-2">{error}</p>
          )}
          <ShelfView entries={entries ?? []} />
        </div>
      </div>
    </div>
  );
}
