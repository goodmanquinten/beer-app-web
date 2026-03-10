"use server";

import { createClient } from "@/lib/supabase/server";

export async function createBeer(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("beers")
    .insert({
      name: formData.get("name") as string,
      brewery: formData.get("brewery") as string,
      style: formData.get("style") as string,
      abv: formData.get("abv") ? parseFloat(formData.get("abv") as string) : null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function searchBeers(query: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("beers")
    .select("*")
    .ilike("name", `%${query}%`)
    .limit(20);

  if (error) return { error: error.message };
  return { data };
}

/**
 * Search beers using multiple terms from OCR output.
 * Queries each term against name and brewery, then deduplicates results.
 */
export async function updateBeerImageUrl(beerId: string, imageUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Use .select() to verify the update actually affected a row
  const { data, error } = await supabase
    .from("beers")
    .update({ image_url: imageUrl })
    .eq("id", beerId)
    .select("id, image_url");

  console.log("[updateBeerImageUrl] beerId:", beerId, "imageUrl:", imageUrl, "user:", user.id);
  console.log("[updateBeerImageUrl] result data:", data, "error:", error);

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    // RLS blocked the update — try with created_by filter to debug
    const { data: beer } = await supabase
      .from("beers")
      .select("id, created_by, image_url")
      .eq("id", beerId)
      .single();
    console.log("[updateBeerImageUrl] beer record:", beer, "current user:", user.id);
    return { error: "Update blocked by RLS — no rows affected" };
  }
  return { success: true, updated: data[0] };
}

export async function createBeerFromOCR(name: string, brewery: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("beers")
    .insert({
      name,
      brewery,
      style: "Beer",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function searchBeersByTerms(terms: string[]) {
  const supabase = await createClient();

  if (terms.length === 0) return { data: [] };

  // Build OR filter: match any term against name or brewery
  const orFilters = terms
    .slice(0, 10) // limit to avoid huge queries
    .flatMap((term) => [
      `name.ilike.%${term}%`,
      `brewery.ilike.%${term}%`,
    ])
    .join(",");

  const { data, error } = await supabase
    .from("beers")
    .select("*")
    .or(orFilters)
    .limit(20);

  if (error) return { error: error.message };
  return { data };
}
