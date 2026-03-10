"use server";

import { createClient } from "@/lib/supabase/server";
import type { Activity } from "@/lib/types/database";

// ─── Activity Creation ───────────────────────────────────────────────────────

export async function createActivity(
  type: Activity["type"],
  objectType: string | null,
  objectId: string | null,
  metadata: Record<string, unknown> | null = null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("activities")
    .insert({
      actor_id: user.id,
      type,
      object_type: objectType,
      object_id: objectId,
      metadata,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

/**
 * Create a beer_logged activity with beer details in metadata.
 * Called after a new beer entry is created.
 */
export async function createBeerLoggedActivity(
  beerId: string,
  beerName: string,
  brewery: string,
  entryId: string
) {
  return createActivity("beer_logged", "beer", beerId, {
    beer_name: beerName,
    brewery,
    entry_id: entryId,
  });
}

/**
 * Create a beer_rated activity with rating in metadata.
 * Only created when a rating is added (not on the log itself).
 */
export async function createBeerRatedActivity(
  beerId: string,
  beerName: string,
  brewery: string,
  score: number
) {
  return createActivity("beer_rated", "beer", beerId, {
    beer_name: beerName,
    brewery,
    score,
  });
}

/**
 * Create a milestone activity.
 */
export async function createMilestoneActivity(
  milestoneType: string,
  value: number
) {
  return createActivity("milestone_reached", "milestone", null, {
    milestone_type: milestoneType,
    value,
  });
}

// ─── Feed Queries ────────────────────────────────────────────────────────────

/**
 * Get the activity feed for the current user.
 * Shows activities from accepted friends only.
 */
export async function getFeed(limit = 30, before?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get friend IDs
  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const friendIds = (friendships ?? []).map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  // Include own activities too
  const actorIds = [user.id, ...friendIds];

  if (actorIds.length === 0) {
    return { data: [] };
  }

  let query = supabase
    .from("activities")
    .select("*, actor:profiles!activities_actor_id_fkey(*)")
    .in("actor_id", actorIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  // Get reaction counts and user reactions for these activities
  const activityIds = (data ?? []).map((a) => a.id);

  if (activityIds.length > 0) {
    const [reactionsResult, commentsResult, userReactionsResult] = await Promise.all([
      supabase
        .from("activity_reactions")
        .select("activity_id")
        .in("activity_id", activityIds),
      supabase
        .from("activity_comments")
        .select("activity_id")
        .in("activity_id", activityIds),
      supabase
        .from("activity_reactions")
        .select("activity_id")
        .in("activity_id", activityIds)
        .eq("user_id", user.id),
    ]);

    // Count reactions per activity
    const reactionCounts: Record<string, number> = {};
    (reactionsResult.data ?? []).forEach((r) => {
      reactionCounts[r.activity_id] = (reactionCounts[r.activity_id] || 0) + 1;
    });

    const commentCounts: Record<string, number> = {};
    (commentsResult.data ?? []).forEach((c) => {
      commentCounts[c.activity_id] = (commentCounts[c.activity_id] || 0) + 1;
    });

    const userReacted = new Set(
      (userReactionsResult.data ?? []).map((r) => r.activity_id)
    );

    // Enrich activities
    for (const activity of data ?? []) {
      (activity as Activity).reaction_count = reactionCounts[activity.id] || 0;
      (activity as Activity).comment_count = commentCounts[activity.id] || 0;
      (activity as Activity).user_reacted = userReacted.has(activity.id);
    }
  }

  return { data: data as Activity[] };
}

/**
 * Get activities for a specific user (for their profile).
 */
export async function getUserActivities(userId: string, limit = 20) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("activities")
    .select("*, actor:profiles!activities_actor_id_fkey(*)")
    .eq("actor_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { error: error.message };
  return { data: data as Activity[] };
}

// ─── Reactions ───────────────────────────────────────────────────────────────

export async function toggleReaction(activityId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check if already reacted
  const { data: existing } = await supabase
    .from("activity_reactions")
    .select("id")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    // Remove reaction
    const { error } = await supabase
      .from("activity_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) return { error: error.message };
    return { data: { reacted: false } };
  } else {
    // Add reaction
    const { error } = await supabase
      .from("activity_reactions")
      .insert({
        activity_id: activityId,
        user_id: user.id,
        reaction_type: "cheers",
      });
    if (error) return { error: error.message };
    return { data: { reacted: true } };
  }
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function getComments(activityId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_comments")
    .select("*, user:profiles!activity_comments_user_id_fkey(*)")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  return { data };
}

export async function addComment(activityId: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 500) {
    return { error: "Comment must be 1-500 characters" };
  }

  const { data, error } = await supabase
    .from("activity_comments")
    .insert({
      activity_id: activityId,
      user_id: user.id,
      body: trimmed,
    })
    .select("*, user:profiles!activity_comments_user_id_fkey(*)")
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("activity_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}

// ─── Milestone Check ─────────────────────────────────────────────────────────

/**
 * Check if user just hit a unique-beer milestone and create activity if so.
 * Milestones: 1, 5, 10, 25, 50, 100, 250, 500
 */
export async function checkAndCreateMilestone(userId: string) {
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("beer_entries")
    .select("beer_id")
    .eq("user_id", userId);

  if (!entries) return;

  const uniqueCount = new Set(entries.map((e) => e.beer_id)).size;
  const milestones = [1, 5, 10, 25, 50, 100, 250, 500];

  if (!milestones.includes(uniqueCount)) return;

  // Check if milestone already recorded
  const { data: existing } = await supabase
    .from("activities")
    .select("id")
    .eq("actor_id", userId)
    .eq("type", "milestone_reached")
    .eq("metadata->>milestone_type", "unique_beers")
    .eq("metadata->>value", String(uniqueCount))
    .maybeSingle();

  if (existing) return;

  await supabase.from("activities").insert({
    actor_id: userId,
    type: "milestone_reached",
    object_type: "milestone",
    object_id: null,
    metadata: { milestone_type: "unique_beers", value: uniqueCount },
  });
}
