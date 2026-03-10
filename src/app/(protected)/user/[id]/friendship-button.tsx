"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sendFriendRequest,
  acceptFriendRequest,
  cancelFriendRequest,
  removeFriend,
} from "@/actions/friends";
import type { FriendshipStatus } from "@/lib/types/database";

interface FriendshipButtonProps {
  userId: string;
  status: FriendshipStatus;
  friendshipId?: string;
}

export default function FriendshipButton({
  userId,
  status: initialStatus,
  friendshipId,
}: FriendshipButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();

  async function handleAction() {
    switch (status) {
      case "none": {
        setStatus("pending_sent");
        await sendFriendRequest(userId);
        startTransition(() => router.refresh());
        break;
      }
      case "pending_sent": {
        if (friendshipId) {
          setStatus("none");
          await cancelFriendRequest(friendshipId);
          startTransition(() => router.refresh());
        }
        break;
      }
      case "pending_received": {
        if (friendshipId) {
          setStatus("friends");
          await acceptFriendRequest(friendshipId);
          startTransition(() => router.refresh());
        }
        break;
      }
      case "friends": {
        if (friendshipId) {
          setStatus("none");
          await removeFriend(friendshipId);
          startTransition(() => router.refresh());
        }
        break;
      }
    }
  }

  const config = {
    none: {
      label: "Add Friend",
      bg: "rgba(212, 165, 74, 0.2)",
      color: "var(--gold-accent)",
      border: "1px solid rgba(212, 165, 74, 0.3)",
    },
    pending_sent: {
      label: "Cancel Request",
      bg: "transparent",
      color: "rgba(245, 230, 208, 0.4)",
      border: "1px solid rgba(74, 56, 35, 0.4)",
    },
    pending_received: {
      label: "Accept Request",
      bg: "rgba(212, 165, 74, 0.2)",
      color: "var(--gold-accent)",
      border: "1px solid rgba(212, 165, 74, 0.3)",
    },
    friends: {
      label: "Friends ✓",
      bg: "rgba(212, 165, 74, 0.08)",
      color: "var(--gold-accent)",
      border: "1px solid rgba(212, 165, 74, 0.15)",
    },
  }[status];

  return (
    <button
      onClick={handleAction}
      disabled={isPending}
      className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
      style={{
        background: config.bg,
        color: config.color,
        border: config.border,
      }}
    >
      {config.label}
    </button>
  );
}
