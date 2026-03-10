"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{2,20}$/;

function usernameToEmail(username: string) {
  return `user_${username.toLowerCase()}@beerapp.local`;
}

export async function signUp(formData: FormData) {
  const username = (formData.get("username") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";

  if (!username || !USERNAME_REGEX.test(username)) {
    return { error: "Username must be 2-20 characters (letters, numbers, underscores)" };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }
  if (password.length > 64) {
    return { error: "Password must be 64 characters or fewer" };
  }

  const email = usernameToEmail(username);
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username: username.toLowerCase() },
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "Username already taken" };
    }
    return { error: error.message };
  }

  redirect("/home");
}

export async function logIn(formData: FormData) {
  const username = (formData.get("username") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";

  if (!username || !USERNAME_REGEX.test(username)) {
    return { error: "Username must be 2-20 characters (letters, numbers, underscores)" };
  }
  if (!password) {
    return { error: "Password is required" };
  }

  const email = usernameToEmail(username);
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Invalid username or password" };
  }

  redirect("/home");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
