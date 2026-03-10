"use server";

import { createClient } from "@/lib/supabase/server";

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("profiles")
    .update({
      username: formData.get("username") as string,
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}
