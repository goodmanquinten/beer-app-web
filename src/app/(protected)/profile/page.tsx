import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/actions/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileResult, entriesResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("beer_entries").select("beer_id, rating:ratings(score)").eq("user_id", user.id),
  ]);

  const profile = profileResult.data;
  const entries = entriesResult.data ?? [];

  const uniqueBeers = new Set(entries.map((e) => e.beer_id)).size;
  const totalLogs = entries.length;

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

  // Get friend count
  const { count: friendCount } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  return (
    <div className="shelf-backdrop">
      <div className="max-w-lg mx-auto min-h-dvh px-3 py-4">
        <div className="px-1 pb-4">
          <h1 className="shelf-title text-2xl font-bold">Profile</h1>
        </div>

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
              {profile?.username?.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                @{profile?.username}
              </h2>
              {profile?.bio && (
                <p className="text-sm mt-0.5" style={{ color: "rgba(245, 230, 208, 0.5)" }}>
                  {profile.bio}
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: "rgba(245, 230, 208, 0.3)" }}>
                Member since {new Date(profile?.created_at ?? "").toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="Beers" value={uniqueBeers} />
            <StatBox label="Logs" value={totalLogs} />
            <StatBox label="Avg" value={avgRating !== null ? `★${avgRating}` : "—"} />
            <StatBox label="Friends" value={friendCount ?? 0} />
          </div>
        </div>

        {/* Quick links */}
        <div className="space-y-2 mb-6">
          <Link
            href="/friends"
            className="flex items-center justify-between rounded-xl px-4 py-3.5"
            style={{
              background: "rgba(35, 26, 14, 0.5)",
              border: "1px solid rgba(74, 56, 35, 0.3)",
            }}
          >
            <span className="text-sm" style={{ color: "var(--foreground)" }}>Friends</span>
            <span className="text-xs" style={{ color: "rgba(245, 230, 208, 0.3)" }}>→</span>
          </Link>
          <Link
            href="/feed"
            className="flex items-center justify-between rounded-xl px-4 py-3.5"
            style={{
              background: "rgba(35, 26, 14, 0.5)",
              border: "1px solid rgba(74, 56, 35, 0.3)",
            }}
          >
            <span className="text-sm" style={{ color: "var(--foreground)" }}>Activity Feed</span>
            <span className="text-xs" style={{ color: "rgba(245, 230, 208, 0.3)" }}>→</span>
          </Link>
        </div>

        {/* Sign out */}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              background: "rgba(220, 38, 38, 0.1)",
              color: "rgba(248, 113, 113, 0.8)",
              border: "1px solid rgba(220, 38, 38, 0.2)",
            }}
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg p-2.5 text-center" style={{ background: "rgba(17, 14, 8, 0.5)" }}>
      <p className="text-base font-bold" style={{ color: "var(--gold-accent)" }}>{value}</p>
      <p className="text-[9px]" style={{ color: "rgba(245, 230, 208, 0.35)" }}>{label}</p>
    </div>
  );
}
