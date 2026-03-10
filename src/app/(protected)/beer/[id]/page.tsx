import { createClient } from "@/lib/supabase/server";
import StarRating from "@/components/star-rating";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BeerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: beer } = await supabase
    .from("beers")
    .select("*")
    .eq("id", id)
    .single();

  if (!beer) {
    return (
      <div className="shelf-backdrop">
        <div className="max-w-lg mx-auto px-3 py-4">
          <p style={{ color: "var(--foreground)" }}>Beer not found.</p>
          <Link href="/home" className="text-sm" style={{ color: "var(--gold-accent)" }}>
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  const { data: entries } = await supabase
    .from("beer_entries")
    .select("*, rating:ratings(*), profile:profiles!beer_entries_user_id_fkey(*)")
    .eq("beer_id", id)
    .order("created_at", { ascending: false });

  // Get friend IDs for social context
  let friendIds: string[] = [];
  if (user) {
    const { data: friendships } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    friendIds = (friendships ?? []).map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );
  }

  // Separate friend entries from other entries
  const friendEntries = (entries ?? []).filter(
    (e) => friendIds.includes(e.user_id) && e.user_id !== user?.id
  );
  const myEntries = (entries ?? []).filter((e) => e.user_id === user?.id);
  const otherEntries = (entries ?? []).filter(
    (e) => e.user_id !== user?.id && !friendIds.includes(e.user_id)
  );

  return (
    <div className="shelf-backdrop">
      <div className="max-w-lg mx-auto min-h-dvh px-3 py-4">
        <Link href="/home" className="text-sm mb-4 inline-block" style={{ color: "var(--gold-accent)" }}>
          ← Back
        </Link>

        {/* Beer info card */}
        <div
          className="rounded-xl p-5 mb-4"
          style={{
            background: "rgba(35, 26, 14, 0.7)",
            border: "1px solid rgba(74, 56, 35, 0.4)",
          }}
        >
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            {beer.name}
          </h1>
          <p className="text-sm" style={{ color: "rgba(245, 230, 208, 0.5)" }}>
            {beer.brewery}
          </p>
          <div className="mt-2 flex gap-3 text-xs" style={{ color: "rgba(245, 230, 208, 0.4)" }}>
            {beer.style && <span>{beer.style}</span>}
            {beer.abv && <span>{beer.abv}% ABV</span>}
          </div>
        </div>

        {/* Friend social context */}
        {friendEntries.length > 0 && (
          <div className="mb-4">
            <h2
              className="text-sm font-semibold mb-2 px-1"
              style={{ color: "var(--gold-accent)" }}
            >
              🍻 Friends who&apos;ve had this
            </h2>
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(212, 165, 74, 0.05)",
                border: "1px solid rgba(212, 165, 74, 0.15)",
              }}
            >
              {friendEntries.map((entry) => {
                const rating = Array.isArray(entry.rating) ? entry.rating[0] : entry.rating;
                return (
                  <div key={entry.id} className="flex items-center justify-between py-1.5">
                    <Link
                      href={`/user/${entry.user_id}`}
                      className="text-sm font-medium"
                      style={{ color: "var(--gold-accent)" }}
                    >
                      @{entry.profile?.username}
                    </Link>
                    <div className="flex items-center gap-2">
                      {rating && <StarRating score={rating.score} />}
                      <span className="text-[10px]" style={{ color: "rgba(245, 230, 208, 0.3)" }}>
                        {new Date(entry.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* My entries */}
        {myEntries.length > 0 && (
          <div className="mb-4">
            <h2
              className="text-sm font-semibold mb-2 px-1"
              style={{ color: "rgba(245, 230, 208, 0.5)" }}
            >
              Your Entries
            </h2>
            {myEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {/* Other entries */}
        {otherEntries.length > 0 && (
          <div>
            <h2
              className="text-sm font-semibold mb-2 px-1"
              style={{ color: "rgba(245, 230, 208, 0.5)" }}
            >
              All Entries
            </h2>
            {otherEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {(entries?.length ?? 0) === 0 && (
          <p className="text-sm px-1" style={{ color: "rgba(245, 230, 208, 0.35)" }}>
            No entries yet.
          </p>
        )}
      </div>
    </div>
  );
}

function EntryCard({ entry }: { entry: { id: string; user_id: string; notes: string | null; created_at: string; profile?: { username: string } | null; rating?: unknown } }) {
  const rating = Array.isArray(entry.rating) ? entry.rating[0] : entry.rating;

  return (
    <div
      className="rounded-lg px-4 py-3 mb-2"
      style={{
        background: "rgba(35, 26, 14, 0.5)",
        border: "1px solid rgba(74, 56, 35, 0.25)",
      }}
    >
      <div className="flex justify-between items-start">
        <span className="text-sm" style={{ color: "rgba(245, 230, 208, 0.6)" }}>
          @{entry.profile?.username ?? "unknown"}
        </span>
        {rating && typeof rating === "object" && "score" in rating && (
          <StarRating score={(rating as { score: number }).score} />
        )}
      </div>
      {entry.notes && (
        <p className="mt-1 text-sm" style={{ color: "rgba(245, 230, 208, 0.5)" }}>
          {entry.notes}
        </p>
      )}
      <p className="mt-1 text-[10px]" style={{ color: "rgba(245, 230, 208, 0.25)" }}>
        {new Date(entry.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
