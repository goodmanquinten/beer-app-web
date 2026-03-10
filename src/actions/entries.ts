"use server";

import { createClient } from "@/lib/supabase/server";

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
  return { success: true };
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
  // Debug: log beer image_urls
  if (data) {
    for (const entry of data) {
      if (entry.beer) {
        console.log(`[getUserEntries] beer=${entry.beer.name} image_url=${entry.beer.image_url}`);
      }
    }
  }
  return { data };
}
