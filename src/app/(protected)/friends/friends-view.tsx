"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Friendship, UserProfile } from "@/lib/types/database";
import {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
} from "@/actions/friends";
import { useRouter } from "next/navigation";

interface FriendsViewProps {
  friends: Array<{ friendship: Friendship; profile: UserProfile }>;
  incoming: Friendship[];
  outgoing: Friendship[];
  currentUserId: string;
}

type Tab = "friends" | "requests" | "search";

export default function FriendsView({
  friends,
  incoming,
  outgoing,
  currentUserId,
}: FriendsViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(incoming.length > 0 ? "requests" : "friends");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const result = await searchUsers(q);
    setSearchResults(result.data ?? []);
    setSearching(false);
  }

  async function handleSendRequest(userId: string) {
    await sendFriendRequest(userId);
    startTransition(() => router.refresh());
  }

  async function handleAccept(friendshipId: string) {
    await acceptFriendRequest(friendshipId);
    startTransition(() => router.refresh());
  }

  async function handleDecline(friendshipId: string) {
    await declineFriendRequest(friendshipId);
    startTransition(() => router.refresh());
  }

  async function handleCancel(friendshipId: string) {
    await cancelFriendRequest(friendshipId);
    startTransition(() => router.refresh());
  }

  async function handleRemove(friendshipId: string) {
    await removeFriend(friendshipId);
    startTransition(() => router.refresh());
  }

  // Check if a search result user is already a friend or has a pending request
  const friendIds = new Set(friends.map((f) => f.profile.id));
  const outgoingIds = new Set(outgoing.map((f) => f.addressee_id));
  const incomingIds = new Set(incoming.map((f) => f.requester_id));

  const tabStyle = (t: Tab) => ({
    color: tab === t ? "var(--gold-accent)" : "rgba(245, 230, 208, 0.4)",
    borderBottom: tab === t ? "2px solid var(--gold-accent)" : "2px solid transparent",
  });

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: "1px solid rgba(74, 56, 35, 0.3)" }}>
        <button
          onClick={() => setTab("friends")}
          className="px-4 py-2 text-sm font-medium transition-colors"
          style={tabStyle("friends")}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setTab("requests")}
          className="px-4 py-2 text-sm font-medium transition-colors relative"
          style={tabStyle("requests")}
        >
          Requests
          {incoming.length > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold"
              style={{ background: "var(--gold-accent)", color: "var(--background)" }}
            >
              {incoming.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab("search"); }}
          className="px-4 py-2 text-sm font-medium transition-colors"
          style={tabStyle("search")}
        >
          Search
        </button>
      </div>

      {/* Search tab */}
      {tab === "search" && (
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by username..."
            className="w-full rounded-lg px-4 py-3 text-sm outline-none mb-4"
            style={{
              background: "rgba(35, 26, 14, 0.6)",
              border: "1px solid rgba(74, 56, 35, 0.4)",
              color: "var(--foreground)",
            }}
            autoFocus
          />

          {searching && (
            <p className="text-xs text-center py-4" style={{ color: "rgba(245, 230, 208, 0.4)" }}>
              Searching...
            </p>
          )}

          {searchResults.map((user) => {
            const isFriend = friendIds.has(user.id);
            const isPendingOut = outgoingIds.has(user.id);
            const isPendingIn = incomingIds.has(user.id);

            return (
              <UserRow key={user.id} user={user}>
                {isFriend && (
                  <span className="text-xs px-3 py-1 rounded-full" style={{ color: "var(--gold-accent)", background: "rgba(212, 165, 74, 0.1)" }}>
                    Friends
                  </span>
                )}
                {isPendingOut && (
                  <span className="text-xs px-3 py-1 rounded-full" style={{ color: "rgba(245, 230, 208, 0.5)" }}>
                    Pending
                  </span>
                )}
                {isPendingIn && (
                  <span className="text-xs px-3 py-1 rounded-full" style={{ color: "var(--gold-accent)" }}>
                    Accept?
                  </span>
                )}
                {!isFriend && !isPendingOut && !isPendingIn && (
                  <button
                    onClick={() => handleSendRequest(user.id)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium"
                    style={{
                      background: "rgba(212, 165, 74, 0.2)",
                      color: "var(--gold-accent)",
                      border: "1px solid rgba(212, 165, 74, 0.3)",
                    }}
                  >
                    Add Friend
                  </button>
                )}
              </UserRow>
            );
          })}

          {query.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: "rgba(245, 230, 208, 0.35)" }}>
              No users found
            </p>
          )}
        </div>
      )}

      {/* Requests tab */}
      {tab === "requests" && (
        <div>
          {incoming.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold mb-2 px-1" style={{ color: "rgba(245, 230, 208, 0.5)" }}>
                Incoming
              </h3>
              {incoming.map((f) => (
                <UserRow key={f.id} user={f.requester!}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(f.id)}
                      className="text-xs px-3 py-1.5 rounded-full font-medium"
                      style={{
                        background: "rgba(212, 165, 74, 0.2)",
                        color: "var(--gold-accent)",
                        border: "1px solid rgba(212, 165, 74, 0.3)",
                      }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(f.id)}
                      className="text-xs px-3 py-1.5 rounded-full"
                      style={{ color: "rgba(245, 230, 208, 0.4)" }}
                    >
                      Decline
                    </button>
                  </div>
                </UserRow>
              ))}
            </div>
          )}

          {outgoing.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-2 px-1" style={{ color: "rgba(245, 230, 208, 0.5)" }}>
                Sent
              </h3>
              {outgoing.map((f) => (
                <UserRow key={f.id} user={f.addressee!}>
                  <button
                    onClick={() => handleCancel(f.id)}
                    className="text-xs px-3 py-1.5 rounded-full"
                    style={{ color: "rgba(245, 230, 208, 0.4)" }}
                  >
                    Cancel
                  </button>
                </UserRow>
              ))}
            </div>
          )}

          {incoming.length === 0 && outgoing.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: "rgba(245, 230, 208, 0.35)" }}>
              No pending requests
            </p>
          )}
        </div>
      )}

      {/* Friends tab */}
      {tab === "friends" && (
        <div>
          {friends.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm mb-2" style={{ color: "rgba(245, 230, 208, 0.5)" }}>
                No friends yet
              </p>
              <button
                onClick={() => setTab("search")}
                className="text-xs font-medium"
                style={{ color: "var(--gold-accent)" }}
              >
                Search for friends →
              </button>
            </div>
          )}

          {friends.map(({ friendship, profile }) => (
            <UserRow key={friendship.id} user={profile} href={`/user/${profile.id}`}>
              <div className="flex gap-2 items-center">
                <Link
                  href={`/compare/${profile.id}`}
                  className="text-xs px-3 py-1.5 rounded-full"
                  style={{
                    background: "rgba(212, 165, 74, 0.1)",
                    color: "var(--gold-accent)",
                  }}
                >
                  Compare
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); handleRemove(friendship.id); }}
                  className="text-xs px-2 py-1.5 rounded-full"
                  style={{ color: "rgba(245, 230, 208, 0.25)" }}
                >
                  ✕
                </button>
              </div>
            </UserRow>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared user row component ───────────────────────────────────────────────

function UserRow({
  user,
  href,
  children,
}: {
  user: UserProfile;
  href?: string;
  children: React.ReactNode;
}) {
  const content = (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-3 mb-2"
      style={{ background: "rgba(35, 26, 14, 0.5)" }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm"
        style={{
          background: "rgba(212, 165, 74, 0.15)",
          color: "var(--gold-accent)",
        }}
      >
        {user.username?.charAt(0).toUpperCase() || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
          @{user.username}
        </p>
        {user.bio && (
          <p className="text-xs truncate" style={{ color: "rgba(245, 230, 208, 0.4)" }}>
            {user.bio}
          </p>
        )}
      </div>
      {children}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
