"use server";

import { createClient } from "@/lib/supabase/server";
import { createBeerLoggedActivity, createBeerRatedActivity, checkAndCreateMilestone } from "@/actions/activities";
import type { UserShelfItem } from "@/lib/types/database";

async function ensureShelfItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  beerId: string
) {
  const { data: existing, error: existingError } = await supabase
    .from("user_shelf_items")
    .select("beer_id")
    .eq("user_id", userId)
    .eq("beer_id", beerId)
    .maybeSingle();

  if (existingError) return { error: existingError.message };
  if (existing) return { success: true };

  const { data: shelfItems, error: shelfError } = await supabase
    .from("user_shelf_items")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (shelfError) return { error: shelfError.message };

  const nextSortOrder = typeof shelfItems?.[0]?.sort_order === "number"
    ? shelfItems[0].sort_order + 1
    : 0;

  const { error: insertError } = await supabase
    .from("user_shelf_items")
    .insert({
      user_id: userId,
      beer_id: beerId,
      sort_order: nextSortOrder,
    });

  if (insertError && insertError.code !== "23505") {
    return { error: insertError.message };
  }

  return { success: true };
}

export async function createEntry(beerId: string, notes?: string, location?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("beer_entries")
    .insert({
      user_id: user.id,
      beer_id: beerId,
      notes: notes || null,
      location: location || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Shelf item creation is best-effort — the entry already exists at this point
  await ensureShelfItem(supabase, user.id, beerId).catch(() => {});

  // Create activity and check milestones (fire and forget)
  const { data: beer } = await supabase
    .from("beers")
    .select("name, brewery")
    .eq("id", beerId)
    .single();

  if (beer && data) {
    createBeerLoggedActivity(beerId, beer.name, beer.brewery, data.id).catch(() => {});
    checkAndCreateMilestone(user.id).catch(() => {});
  }

  return { data };
}

export async function deleteEntry(entryId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("beer_entries")
    .delete()
    .eq("id", entryId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function addRating(entryId: string, score: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("ratings")
    .upsert(
      {
        entry_id: entryId,
        user_id: user.id,
        score,
      },
      { onConflict: "entry_id,user_id" }
    )
    .select()
    .single();

  if (error) return { error: error.message };

  // Create beer_rated activity (fire and forget)
  if (data) {
    // Get beer info for the activity
    const { data: entry } = await supabase
      .from("beer_entries")
      .select("beer_id, beer:beers(name, brewery)")
      .eq("id", entryId)
      .single();

    if (entry?.beer) {
      const beer = Array.isArray(entry.beer) ? entry.beer[0] : entry.beer;
      if (beer) {
        createBeerRatedActivity(entry.beer_id, beer.name, beer.brewery, score).catch(() => {});
      }
    }
  }

  return { data };
}

export async function removeBeerFromShelf(beerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Delete all entries for this beer by this user
  const { error } = await supabase
    .from("beer_entries")
    .delete()
    .eq("beer_id", beerId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  const { error: shelfError } = await supabase
    .from("user_shelf_items")
    .delete()
    .eq("beer_id", beerId)
    .eq("user_id", user.id);

  if (shelfError) return { error: shelfError.message };
  return { success: true };
}

export async function removeAllFromShelf() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("beer_entries")
    .delete()
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  const { error: shelfError } = await supabase
    .from("user_shelf_items")
    .delete()
    .eq("user_id", user.id);

  if (shelfError) return { error: shelfError.message };
  return { success: true };
}

export async function getUserShelfItems() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("user_shelf_items")
    .select("user_id, beer_id, sort_order, created_at, beer:beers(*)")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) return { error: error.message };

  // Supabase joins may return beer as array or object depending on PostgREST;
  // normalize to single Beer object to match UserShelfItem type
  const items: UserShelfItem[] = (data ?? []).map((row) => ({
    user_id: row.user_id,
    beer_id: row.beer_id,
    sort_order: row.sort_order,
    created_at: row.created_at,
    beer: Array.isArray(row.beer) ? row.beer[0] : row.beer,
  }));

  return { data: items };
}

export async function updateShelfArrangement(beerIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const normalizedIds = Array.from(
    new Set(beerIds.map((beerId) => beerId.trim()).filter(Boolean))
  );

  const { data: existingItems, error: existingError } = await supabase
    .from("user_shelf_items")
    .select("beer_id")
    .eq("user_id", user.id);

  if (existingError) return { error: existingError.message };

  const existingIds = new Set((existingItems ?? []).map((item) => item.beer_id));
  const orderedIds = normalizedIds.filter((beerId) => existingIds.has(beerId));

  const missingIds = Array.from(existingIds).filter(
    (beerId) => !orderedIds.includes(beerId)
  );

  const finalIds = [...orderedIds, ...missingIds];

  const rows = finalIds.map((beerId, index) => ({
    user_id: user.id,
    beer_id: beerId,
    sort_order: index,
  }));

  const { error: upsertError } = await supabase
    .from("user_shelf_items")
    .upsert(rows, { onConflict: "user_id,beer_id" });

  if (upsertError) return { error: upsertError.message };

  return { data: finalIds };
}

export async function getBeerRatings(beerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Get all entries+ratings for this beer (global)
  const { data: allEntries } = await supabase
    .from("beer_entries")
    .select("id, user_id, rating:ratings(score)")
    .eq("beer_id", beerId);

  // Extract all scores
  const allScores: number[] = [];
  const personalScores: { entryId: string; score: number }[] = [];

  for (const entry of allEntries ?? []) {
    const r = Array.isArray(entry.rating) ? entry.rating[0] : entry.rating;
    if (r && typeof r === "object" && "score" in r) {
      const score = (r as { score: number }).score;
      allScores.push(score);
      if (entry.user_id === user.id) {
        personalScores.push({ entryId: entry.id, score });
      }
    }
  }

  const globalAvg =
    allScores.length > 0
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
      : null;

  // Personal rating (most recent)
  const personalRating = personalScores.length > 0 ? personalScores[0] : null;

  // Friends avg: get friend IDs, filter scores
  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const friendIds = new Set(
    (friendships ?? []).map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    )
  );

  const friendScores: number[] = [];
  for (const entry of allEntries ?? []) {
    if (!friendIds.has(entry.user_id)) continue;
    const r = Array.isArray(entry.rating) ? entry.rating[0] : entry.rating;
    if (r && typeof r === "object" && "score" in r) {
      friendScores.push((r as { score: number }).score);
    }
  }

  const friendsAvg =
    friendScores.length > 0
      ? Math.round((friendScores.reduce((a, b) => a + b, 0) / friendScores.length) * 10) / 10
      : null;

  return {
    data: {
      globalAvg,
      friendsAvg,
      personalRating,
    },
  };
}

export async function getRecentEntries(limit = 20) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("beer_entries")
    .select("*, beer:beers(*), rating:ratings(*), profile:profiles!beer_entries_user_id_fkey(*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { error: error.message };
  return { data };
}

export async function getUserEntries() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("beer_entries")
    .select("*, beer:beers(*), rating:ratings(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { data };
}
