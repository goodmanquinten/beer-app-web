"use server";

import { createClient } from "@/lib/supabase/server";
import type { Friendship, FriendshipStatus, UserProfile } from "@/lib/types/database";

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function searchUsers(query: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!query || query.trim().length < 2) return { data: [] };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, bio")
    .ilike("username", `%${query.trim()}%`)
    .neq("id", user.id)
    .limit(20);

  if (error) return { error: error.message };
  return { data: data as UserProfile[] };
}

export async function getFriends() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("friendships")
    .select("*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) return { error: error.message };

  // Extract the friend profile from each friendship
  const friends = (data ?? []).map((f: Friendship) => {
    const friendProfile = f.requester_id === user.id ? f.addressee : f.requester;
    return { friendship: f, profile: friendProfile! };
  });

  return { data: friends };
}

export async function getIncomingRequests() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("friendships")
    .select("*, requester:profiles!friendships_requester_id_fkey(*)")
    .eq("addressee_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { data: data as Friendship[] };
}

export async function getOutgoingRequests() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("friendships")
    .select("*, addressee:profiles!friendships_addressee_id_fkey(*)")
    .eq("requester_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { data: data as Friendship[] };
}

export async function getFriendshipStatus(otherUserId: string): Promise<{ data?: FriendshipStatus; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (otherUserId === user.id) return { data: "friends" }; // self

  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`
    )
    .in("status", ["pending", "accepted"])
    .limit(1)
    .maybeSingle();

  if (error) return { error: error.message };

  if (!data) return { data: "none" };
  if (data.status === "accepted") return { data: "friends" };
  if (data.requester_id === user.id) return { data: "pending_sent" };
  return { data: "pending_received" };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function sendFriendRequest(addresseeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (addresseeId === user.id) return { error: "Cannot friend yourself" };

  // Check for existing friendship in either direction
  const { data: existing } = await supabase
    .from("friendships")
    .select("id, status")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`
    )
    .in("status", ["pending", "accepted"])
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") return { error: "Already friends" };
    return { error: "Request already pending" };
  }

  const { data, error } = await supabase
    .from("friendships")
    .insert({ requester_id: user.id, addressee_id: addresseeId })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function acceptFriendRequest(friendshipId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("friendships")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .eq("addressee_id", user.id)
    .eq("status", "pending")
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function declineFriendRequest(friendshipId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("friendships")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .eq("addressee_id", user.id)
    .eq("status", "pending")
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function cancelFriendRequest(friendshipId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("friendships")
    .update({ status: "canceled" })
    .eq("id", friendshipId)
    .eq("requester_id", user.id)
    .eq("status", "pending")
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function removeFriend(friendshipId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Either party can remove the friendship
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) return { error: error.message };
  return { success: true };
}
