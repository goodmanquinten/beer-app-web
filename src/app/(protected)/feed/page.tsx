import { createClient } from "@/lib/supabase/server";
import { getFeed } from "@/actions/activities";
import ActivityCard from "@/components/activity-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: activities, error } = await getFeed(30);

  return (
    <div className="shelf-backdrop">
      <div className="max-w-lg mx-auto min-h-dvh px-3 py-4">
        {/* Header */}
        <div className="flex items-center justify-between px-1 pb-4">
          <h1 className="shelf-title text-2xl font-bold">Feed</h1>
        </div>

        {error && (
          <p className="text-red-400 text-sm px-2 pb-2">{error}</p>
        )}

        {/* Empty state */}
        {(!activities || activities.length === 0) && !error && (
          <div className="text-center py-12">
            <p className="text-lg mb-2" style={{ color: "var(--gold-accent)", opacity: 0.7 }}>
              No activity yet
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--gold-dim)", opacity: 0.5 }}>
              Add friends to see what they&apos;re drinking
            </p>
            <Link
              href="/friends"
              className="inline-block rounded-lg px-5 py-2 text-sm font-medium transition-colors"
              style={{
                background: "rgba(212, 165, 74, 0.15)",
                color: "var(--gold-accent)",
                border: "1px solid rgba(212, 165, 74, 0.3)",
              }}
            >
              Find Friends
            </Link>
          </div>
        )}

        {/* Activity list */}
        {activities && activities.length > 0 && (
          <div>
            {activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                currentUserId={user.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
