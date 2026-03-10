import { createClient } from "@/lib/supabase/server";
import { getFriendshipStatus } from "@/actions/friends";
import { getUserActivities } from "@/actions/activities";
import Link from "next/link";
import FriendshipButton from "./friendship-button";
import ActivityCard from "@/components/activity-card";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Redirect to own profile if viewing self
  if (userId === user.id) {
    const { redirect } = await import("next/navigation");
    redirect("/profile");
  }

  // Fetch profile, stats, friendship status, and activities in parallel
  const [profileResult, statsResult, friendshipResult, activitiesResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("beer_entries").select("beer_id, rating:ratings(score)").eq("user_id", userId),
    getFriendshipStatus(userId),
    getUserActivities(userId, 10),
  ]);

  const profile = profileResult.data;
  if (!profile) {
    return (
      <div className="shelf-backdrop">
        <div className="max-w-lg mx-auto px-3 py-4">
          <p style={{ color: "var(--foreground)" }}>User not found.</p>
          <Link href="/friends" className="text-sm" style={{ color: "var(--gold-accent)" }}>
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  const entries = statsResult.data ?? [];
  const uniqueBeers = new Set(entries.map((e) => e.beer_id)).size;
  const totalLogs = entries.length;

  // Calculate average rating
  const allRatings = entries
    .flatMap((e) => {
      const r = Array.isArray(e.rating) ? e.rating : e.rating ? [e.rating] : [];
      return r.map((x: { score: number }) => x.score);
    })
    .filter((s): s is number => typeof s === "number");

  const avgRating =
    allRatings.length > 0
      ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
      : null;

  const friendshipStatus = friendshipResult.data ?? "none";
  const activities = activitiesResult.data ?? [];

  // Get the friendship record for the button actions
  const { data: friendshipRecord } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`
    )
    .in("status", ["pending", "accepted"])
    .limit(1)
    .maybeSingle();

  return (
    <div className="shelf-backdrop">
      <div className="max-w-lg mx-auto min-h-dvh px-3 py-4">
        <Link href="/friends" className="text-sm mb-4 inline-block" style={{ color: "var(--gold-accent)" }}>
          ← Back
        </Link>

        {/* Profile card */}
        <div
          className="rounded-xl p-5 mb-4"
          style={{
            background: "rgba(35, 26, 14, 0.7)",
            border: "1px solid rgba(74, 56, 35, 0.4)",
          }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{
                background: "rgba(212, 165, 74, 0.15)",
                color: "var(--gold-accent)",
              }}
            >
              {profile.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                @{profile.username}
              </h1>
              {profile.bio && (
                <p className="text-sm mt-0.5" style={{ color: "rgba(245, 230, 208, 0.5)" }}>
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatBox label="Unique Beers" value={uniqueBeers} />
            <StatBox label="Total Logs" value={totalLogs} />
            <StatBox label="Avg Rating" value={avgRating !== null ? `★ ${avgRating}` : "—"} />
          </div>

          {/* Friendship + Compare buttons */}
          <div className="flex gap-2">
            <FriendshipButton
              userId={userId}
              status={friendshipStatus}
              friendshipId={friendshipRecord?.id}
            />
            {friendshipStatus === "friends" && (
              <Link
                href={`/compare/${userId}`}
                className="flex-1 text-center rounded-lg px-4 py-2.5 text-sm font-medium"
                style={{
                  background: "rgba(212, 165, 74, 0.1)",
                  color: "var(--gold-accent)",
                  border: "1px solid rgba(212, 165, 74, 0.25)",
                }}
              >
                Compare Collections
              </Link>
            )}
          </div>
        </div>

        {/* Recent activity (only show if friends) */}
        {friendshipStatus === "friends" && activities.length > 0 && (
          <div>
            <h2
              className="text-sm font-semibold mb-3 px-1"
              style={{ color: "rgba(245, 230, 208, 0.5)" }}
            >
              Recent Activity
            </h2>
            {activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                currentUserId={user.id}
              />
            ))}
          </div>
        )}

        {friendshipStatus !== "friends" && (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: "rgba(245, 230, 208, 0.35)" }}>
              Add {profile.username} as a friend to see their activity and compare collections
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="rounded-lg p-3 text-center"
      style={{ background: "rgba(17, 14, 8, 0.5)" }}
    >
      <p className="text-lg font-bold" style={{ color: "var(--gold-accent)" }}>
        {value}
      </p>
      <p className="text-[10px]" style={{ color: "rgba(245, 230, 208, 0.4)" }}>
        {label}
      </p>
    </div>
  );
}
