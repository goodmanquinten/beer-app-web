"use server";

import { createClient } from "@/lib/supabase/server";
import type { Beer } from "@/lib/types/database";

function isMissingContainerTypeColumn(message: string | undefined) {
  return (message ?? "").toLowerCase().includes("container_type");
}

function getMissingContainerTypeError() {
  return "Bottle/can variants require the container_type migration in Supabase. Apply migration 004_beer_container_type.sql.";
}

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
      container_type: (formData.get("container_type") as string) || "can",
      created_by: user.id,
    })
    .select()
    .single();

  if (error && isMissingContainerTypeColumn(error.message)) {
    return { error: getMissingContainerTypeError() };
  }

  if (error) return { error: error.message };
  return { data };
}

export async function searchBeers(
  query: string,
  options?: { brewery?: string; containerType?: Beer["container_type"] }
) {
  const supabase = await createClient();

  let request = supabase
    .from("beers")
    .select("*")
    .ilike("name", `%${query}%`)
    .limit(20);

  if (options?.brewery) {
    request = request.ilike("brewery", `%${options.brewery}%`);
  }

  if (options?.containerType) {
    request = request.eq("container_type", options.containerType);
  }

  const { data, error } = await request;

  if (error && isMissingContainerTypeColumn(error.message)) {
    return { error: getMissingContainerTypeError() };
  }

  if (error) return { error: error.message };
  return { data };
}

export async function updateBeerImageUrl(beerId: string, imageUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("beers")
    .update({ image_url: imageUrl })
    .eq("id", beerId)
    .select("id, image_url");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Update blocked by RLS - no rows affected" };
  }
  return { success: true, updated: data[0] };
}

export async function createBeerFromOCR(
  name: string,
  brewery: string,
  style: string,
  containerType: Beer["container_type"]
) {
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
      style: style || "Beer",
      container_type: containerType,
      created_by: user.id,
    })
    .select()
    .single();

  if (error && isMissingContainerTypeColumn(error.message)) {
    return { error: getMissingContainerTypeError() };
  }

  if (error) return { error: error.message };
  return { data };
}

export async function searchBeersByTerms(
  terms: string[],
  options?: { containerType?: Beer["container_type"] }
) {
  const supabase = await createClient();

  if (terms.length === 0) return { data: [] };

  const orFilters = terms
    .slice(0, 10)
    .flatMap((term) => [
      `name.ilike.%${term}%`,
      `brewery.ilike.%${term}%`,
    ])
    .join(",");

  let request = supabase
    .from("beers")
    .select("*")
    .or(orFilters)
    .limit(20);

  if (options?.containerType) {
    request = request.eq("container_type", options.containerType);
  }

  const { data, error } = await request;

  if (error && isMissingContainerTypeColumn(error.message)) {
    return { error: getMissingContainerTypeError() };
  }

  if (error) return { error: error.message };
  return { data };
}
