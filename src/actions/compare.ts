"use server";

import { createClient } from "@/lib/supabase/server";
import type { Beer, CompareResult } from "@/lib/types/database";

/**
 * Compare current user's collection with another user.
 * Returns shared beers, exclusive beers, overlap %, and taste match.
 */
export async function compareWithUser(otherUserId: string): Promise<{ data?: CompareResult; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify friendship
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  if (!friendship) return { error: "Must be friends to compare" };

  // Get both users' entries with ratings and beer data
  const [myEntriesResult, theirEntriesResult] = await Promise.all([
    supabase
      .from("beer_entries")
      .select("beer_id, beer:beers(*), rating:ratings(*)")
      .eq("user_id", user.id),
    supabase
      .from("beer_entries")
      .select("beer_id, beer:beers(*), rating:ratings(*)")
      .eq("user_id", otherUserId),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myEntries = (myEntriesResult.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const theirEntries = (theirEntriesResult.data ?? []) as any[];

  // Build beer maps (unique beers per user with avg rating)
  const myBeers = buildBeerMap(myEntries);
  const theirBeers = buildBeerMap(theirEntries);

  const myBeerIds = new Set(myBeers.keys());
  const theirBeerIds = new Set(theirBeers.keys());

  const sharedIds = [...myBeerIds].filter((id) => theirBeerIds.has(id));
  const onlyMeIds = [...myBeerIds].filter((id) => !theirBeerIds.has(id));
  const onlyThemIds = [...theirBeerIds].filter((id) => !myBeerIds.has(id));

  const union = new Set([...myBeerIds, ...theirBeerIds]);
  const overlapPct = union.size > 0 ? Math.round((sharedIds.length / union.size) * 100) : 0;

  // Calculate taste match based on shared beer ratings
  let tasteMatchPct: number | null = null;
  const disagreements: CompareResult["rating_disagreements"] = [];

  const ratedShared = sharedIds.filter(
    (id) => myBeers.get(id)!.avgRating !== null && theirBeers.get(id)!.avgRating !== null
  );

  if (ratedShared.length >= 2) {
    let totalDiff = 0;
    for (const id of ratedShared) {
      const myRating = myBeers.get(id)!.avgRating!;
      const theirRating = theirBeers.get(id)!.avgRating!;
      const diff = Math.abs(myRating - theirRating);
      totalDiff += diff;

      disagreements.push({
        beer: myBeers.get(id)!.beer,
        my_rating: myRating,
        their_rating: theirRating,
        diff,
      });
    }

    // Max possible diff per beer is 4 (5-1), normalize to 0-100
    const avgDiff = totalDiff / ratedShared.length;
    tasteMatchPct = Math.round(Math.max(0, (1 - avgDiff / 4) * 100));
  }

  // Sort disagreements by diff descending
  disagreements.sort((a, b) => b.diff - a.diff);

  return {
    data: {
      shared_beers: sharedIds.map((id) => myBeers.get(id)!.beer),
      only_me: onlyMeIds.map((id) => myBeers.get(id)!.beer),
      only_them: onlyThemIds.map((id) => theirBeers.get(id)!.beer),
      overlap_pct: overlapPct,
      taste_match_pct: tasteMatchPct,
      rating_disagreements: disagreements.slice(0, 10),
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface BeerMapEntry {
  beer: Beer;
  avgRating: number | null;
}

function buildBeerMap(
  entries: Array<{ beer_id: string; beer: Beer | null; rating: unknown }>
): Map<string, BeerMapEntry> {
  const map = new Map<string, { beer: Beer; ratings: number[] }>();

  for (const entry of entries) {
    if (!entry.beer) continue;

    if (!map.has(entry.beer_id)) {
      map.set(entry.beer_id, { beer: entry.beer as Beer, ratings: [] });
    }

    const rating = Array.isArray(entry.rating) ? entry.rating[0] : entry.rating;
    if (rating && typeof rating === "object" && "score" in rating) {
      map.get(entry.beer_id)!.ratings.push((rating as { score: number }).score);
    }
  }

  const result = new Map<string, BeerMapEntry>();
  for (const [id, { beer, ratings }] of map) {
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
        : null;
    result.set(id, { beer, avgRating });
  }

  return result;
}
