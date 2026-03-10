import { createClient } from "@/lib/supabase/server";
import { getFriends, getIncomingRequests, getOutgoingRequests } from "@/actions/friends";
import FriendsView from "./friends-view";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [friendsResult, incomingResult, outgoingResult] = await Promise.all([
    getFriends(),
    getIncomingRequests(),
    getOutgoingRequests(),
  ]);

  return (
    <div className="shelf-backdrop">
      <div className="max-w-lg mx-auto min-h-dvh px-3 py-4">
        <div className="px-1 pb-4">
          <h1 className="shelf-title text-2xl font-bold">Friends</h1>
        </div>

        <FriendsView
          friends={friendsResult.data ?? []}
          incoming={incomingResult.data ?? []}
          outgoing={outgoingResult.data ?? []}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
