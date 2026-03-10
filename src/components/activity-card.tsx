"use client";

import { useState } from "react";
import Link from "next/link";
import type { Activity } from "@/lib/types/database";
import { toggleReaction } from "@/actions/activities";

interface ActivityCardProps {
  activity: Activity;
  currentUserId: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString();
}

function getActivitySentence(activity: Activity): { text: string; highlight?: string } {
  const meta = activity.metadata as Record<string, unknown> | null;

  switch (activity.type) {
    case "beer_logged":
      return {
        text: "added",
        highlight: (meta?.beer_name as string) || "a beer",
      };
    case "beer_rated": {
      const score = meta?.score as number;
      return {
        text: `rated`,
        highlight: `${(meta?.beer_name as string) || "a beer"} ${score ? `★ ${score}` : ""}`,
      };
    }
    case "milestone_reached": {
      const value = meta?.value as number;
      return {
        text: `reached ${value} unique beers!`,
        highlight: `🏆 Milestone`,
      };
    }
    default:
      return { text: "did something" };
  }
}

export default function ActivityCard({ activity, currentUserId }: ActivityCardProps) {
  const [reacted, setReacted] = useState(activity.user_reacted ?? false);
  const [reactionCount, setReactionCount] = useState(activity.reaction_count ?? 0);
  const [isReacting, setIsReacting] = useState(false);

  const actor = activity.actor;
  const sentence = getActivitySentence(activity);
  const meta = activity.metadata as Record<string, unknown> | null;
  const isOwnActivity = activity.actor_id === currentUserId;

  async function handleReaction() {
    if (isReacting) return;
    setIsReacting(true);

    // Optimistic update
    const wasReacted = reacted;
    setReacted(!wasReacted);
    setReactionCount((c) => (wasReacted ? c - 1 : c + 1));

    const result = await toggleReaction(activity.id);
    if (result.error) {
      // Revert
      setReacted(wasReacted);
      setReactionCount((c) => (wasReacted ? c + 1 : c - 1));
    }
    setIsReacting(false);
  }

  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{
        background: "rgba(35, 26, 14, 0.7)",
        border: "1px solid rgba(74, 56, 35, 0.4)",
      }}
    >
      {/* Header: avatar + username + time */}
      <div className="flex items-center gap-3 mb-2">
        <Link
          href={isOwnActivity ? "/profile" : `/user/${activity.actor_id}`}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm"
          style={{
            background: "rgba(212, 165, 74, 0.15)",
            color: "var(--gold-accent)",
          }}
        >
          {actor?.username?.charAt(0).toUpperCase() || "?"}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <Link
              href={isOwnActivity ? "/profile" : `/user/${activity.actor_id}`}
              className="font-semibold text-sm truncate"
              style={{ color: "var(--foreground)" }}
            >
              {actor?.username || "Unknown"}
            </Link>
            <span className="text-xs" style={{ color: "rgba(245, 230, 208, 0.35)" }}>
              {timeAgo(activity.created_at)}
            </span>
          </div>
          {/* Activity sentence */}
          <p className="text-sm mt-0.5" style={{ color: "rgba(245, 230, 208, 0.65)" }}>
            {sentence.text}{" "}
            {sentence.highlight && (
              <span style={{ color: "var(--gold-accent)" }}>{sentence.highlight}</span>
            )}
            {meta?.brewery && activity.type !== "milestone_reached" && (
              <span style={{ color: "rgba(245, 230, 208, 0.35)" }}>
                {" "}
                · {meta.brewery as string}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 mt-3 pt-2" style={{ borderTop: "1px solid rgba(74, 56, 35, 0.25)" }}>
        {/* Cheers reaction */}
        <button
          onClick={handleReaction}
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{
            color: reacted ? "var(--gold-accent)" : "rgba(245, 230, 208, 0.4)",
          }}
        >
          <span className="text-base">{reacted ? "🍻" : "🍺"}</span>
          <span>{reactionCount > 0 ? reactionCount : ""} Cheers</span>
        </button>

        {/* Comment count */}
        <Link
          href={`/feed/${activity.id}`}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "rgba(245, 230, 208, 0.4)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 3.925 1 5.261v5.478c0 1.336.993 2.506 2.43 2.737.526.085 1.055.156 1.57.214V18l4.998-4.998A10.61 10.61 0 0010 13c2.236 0 4.43-.18 6.57-.524C18.007 12.245 19 11.075 19 9.739V5.261c0-1.336-.993-2.506-2.43-2.737A48.394 48.394 0 0010 2z" clipRule="evenodd" />
          </svg>
          <span>{(activity.comment_count ?? 0) > 0 ? activity.comment_count : ""} Comment</span>
        </Link>

        {/* View beer (only for beer activities) */}
        {activity.object_type === "beer" && activity.object_id && (
          <Link
            href={`/beer/${activity.object_id}`}
            className="flex items-center gap-1.5 text-xs ml-auto"
            style={{ color: "rgba(245, 230, 208, 0.4)" }}
          >
            <span>View Beer →</span>
          </Link>
        )}

        {/* Compare (only for other users' activities) */}
        {!isOwnActivity && (
          <Link
            href={`/compare/${activity.actor_id}`}
            className="flex items-center gap-1.5 text-xs ml-auto"
            style={{ color: "rgba(245, 230, 208, 0.4)" }}
          >
            <span>Compare</span>
          </Link>
        )}
      </div>
    </div>
  );
}
