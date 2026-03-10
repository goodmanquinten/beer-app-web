import { createClient } from "@/lib/supabase/server";
import { getComments } from "@/actions/activities";
import ActivityCard from "@/components/activity-card";
import CommentSection from "./comment-section";
import Link from "next/link";
import type { Activity } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get the activity
  const { data: activity } = await supabase
    .from("activities")
    .select("*, actor:profiles!activities_actor_id_fkey(*)")
    .eq("id", activityId)
    .single();

  if (!activity) {
    return (
      <div className="shelf-backdrop">
        <div className="max-w-lg mx-auto px-3 py-4">
          <p style={{ color: "var(--foreground)" }}>Activity not found.</p>
          <Link href="/feed" className="text-sm" style={{ color: "var(--gold-accent)" }}>
            ← Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const { data: comments } = await getComments(activityId);

  return (
    <div className="shelf-backdrop">
      <div className="max-w-lg mx-auto min-h-dvh px-3 py-4">
        <Link href="/feed" className="text-sm mb-4 inline-block" style={{ color: "var(--gold-accent)" }}>
          ← Back to feed
        </Link>

        <ActivityCard
          activity={activity as Activity}
          currentUserId={user.id}
        />

        <CommentSection
          activityId={activityId}
          initialComments={comments ?? []}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
