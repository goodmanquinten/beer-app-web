import { createClient } from "@/lib/supabase/server";
import StarRating from "@/components/star-rating";
import Link from "next/link";

export default async function BeerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: beer } = await supabase
    .from("beers")
    .select("*")
    .eq("id", id)
    .single();

  const { data: entries } = await supabase
    .from("beer_entries")
    .select("*, rating:ratings(*), profile:profiles!beer_entries_user_id_fkey(*)")
    .eq("beer_id", id)
    .order("created_at", { ascending: false });

  if (!beer) {
    return (
      <div className="max-w-md mx-auto px-4 pt-6">
        <p className="text-gray-500">Beer not found.</p>
        <Link href="/home" className="text-amber-600 hover:underline text-sm">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-6">
      <Link href="/home" className="text-amber-600 hover:underline text-sm">
        &larr; Back
      </Link>

      <div className="mt-4 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">{beer.name}</h1>
        <p className="text-gray-500">{beer.brewery}</p>
        <div className="mt-2 flex gap-3 text-sm text-gray-500">
          {beer.style && <span>{beer.style}</span>}
          {beer.abv && <span>{beer.abv}% ABV</span>}
        </div>
      </div>

      <h2 className="mt-6 mb-3 text-lg font-semibold text-gray-900">Entries</h2>

      {entries && entries.length === 0 && (
        <p className="text-gray-500 text-sm">No entries yet.</p>
      )}

      <div className="space-y-3">
        {entries?.map((entry) => {
          const rating = Array.isArray(entry.rating)
            ? entry.rating[0]
            : entry.rating;
          return (
            <div
              key={entry.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">
                  @{entry.profile?.username ?? "unknown"}
                </span>
                {rating && <StarRating score={rating.score} />}
              </div>
              {entry.notes && (
                <p className="mt-1 text-sm text-gray-600">{entry.notes}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                {new Date(entry.created_at).toLocaleDateString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
