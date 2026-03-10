"use client";

import { useState } from "react";
import { addComment, deleteComment } from "@/actions/activities";
import type { ActivityComment } from "@/lib/types/database";

interface CommentSectionProps {
  activityId: string;
  initialComments: ActivityComment[];
  currentUserId: string;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function CommentSection({
  activityId,
  initialComments,
  currentUserId,
}: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;

    setSubmitting(true);
    const result = await addComment(activityId, body.trim());
    if (result.data) {
      setComments((prev) => [...prev, result.data as ActivityComment]);
      setBody("");
    }
    setSubmitting(false);
  }

  async function handleDelete(commentId: string) {
    await deleteComment(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
    <div className="mt-2">
      <h3
        className="text-sm font-semibold mb-3 px-1"
        style={{ color: "rgba(245, 230, 208, 0.6)" }}
      >
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>

      {/* Comment list */}
      <div className="space-y-2 mb-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="rounded-lg px-3 py-2"
            style={{ background: "rgba(35, 26, 14, 0.5)" }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--gold-accent)" }}>
                {comment.user?.username || "Unknown"}
              </span>
              <span className="text-[10px]" style={{ color: "rgba(245, 230, 208, 0.3)" }}>
                {timeAgo(comment.created_at)}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "rgba(245, 230, 208, 0.75)" }}>
              {comment.body}
            </p>
            {comment.user_id === currentUserId && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="text-[10px] mt-1"
                style={{ color: "rgba(245, 230, 208, 0.25)" }}
              >
                Delete
              </button>
            )}
          </div>
        ))}

        {comments.length === 0 && (
          <p className="text-xs px-1" style={{ color: "rgba(245, 230, 208, 0.3)" }}>
            No comments yet. Be the first!
          </p>
        )}
      </div>

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment..."
          maxLength={500}
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "rgba(35, 26, 14, 0.6)",
            border: "1px solid rgba(74, 56, 35, 0.4)",
            color: "var(--foreground)",
          }}
        />
        <button
          type="submit"
          disabled={!body.trim() || submitting}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-30"
          style={{
            background: "rgba(212, 165, 74, 0.2)",
            color: "var(--gold-accent)",
          }}
        >
          Post
        </button>
      </form>
    </div>
  );
}
