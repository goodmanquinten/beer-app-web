import { createClient } from "@/lib/supabase/server";
import { compareWithUser } from "@/actions/compare";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileResult, compareResult] = await Promise.all([
    supabase.from("profiles").select("username, avatar_url").eq("id", userId).single(),
    compareWithUser(userId),
  ]);

  const friend = profileResult.data;
  const compare = compareResult.data;
  const error = compareResult.error;

  return (
    <div className="shelf-backdrop">
      <div className="max-w-lg mx-auto min-h-dvh px-3 py-4">
        <Link href={`/user/${userId}`} className="text-sm mb-4 inline-block" style={{ color: "var(--gold-accent)" }}>
          ← Back to profile
        </Link>

        <h1 className="shelf-title text-2xl font-bold mb-1">Compare</h1>
        {friend && (
          <p className="text-sm mb-6" style={{ color: "rgba(245, 230, 208, 0.5)" }}>
            You vs @{friend.username}
          </p>
        )}

        {error && (
          <div
            className="rounded-xl p-5 text-center"
            style={{ background: "rgba(35, 26, 14, 0.7)", border: "1px solid rgba(74, 56, 35, 0.4)" }}
          >
            <p className="text-sm" style={{ color: "rgba(245, 230, 208, 0.5)" }}>{error}</p>
          </div>
        )}

        {compare && (
          <>
            {/* Overview stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard
                value={`${compare.overlap_pct}%`}
                label="Collection Overlap"
                accent
              />
              <StatCard
                value={compare.taste_match_pct !== null ? `${compare.taste_match_pct}%` : "—"}
                label="Taste Match"
                accent
              />
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard value={compare.shared_beers.length} label="Shared" />
              <StatCard value={compare.only_me.length} label="Only You" />
              <StatCard value={compare.only_them.length} label={`Only ${friend?.username ?? "Them"}`} />
            </div>

            {/* Shared beers */}
            {compare.shared_beers.length > 0 && (
              <Section title="Shared Beers">
                {compare.shared_beers.map((beer) => (
                  <BeerRow key={beer.id} beer={beer} />
                ))}
              </Section>
            )}

            {/* Rating disagreements */}
            {compare.rating_disagreements.length > 0 && (
              <Section title="Biggest Rating Differences">
                {compare.rating_disagreements.map((d) => (
                  <div
                    key={d.beer.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 mb-1.5"
                    style={{ background: "rgba(35, 26, 14, 0.5)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                        {d.beer.name}
                      </p>
                      <p className="text-[10px]" style={{ color: "rgba(245, 230, 208, 0.35)" }}>
                        {d.beer.brewery}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span style={{ color: "var(--gold-accent)" }}>You: ★{d.my_rating}</span>
                      <span style={{ color: "rgba(245, 230, 208, 0.5)" }}>Them: ★{d.their_rating}</span>
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {/* Only you */}
            {compare.only_me.length > 0 && (
              <Section title="Only You Have">
                {compare.only_me.slice(0, 10).map((beer) => (
                  <BeerRow key={beer.id} beer={beer} />
                ))}
                {compare.only_me.length > 10 && (
                  <p className="text-xs text-center py-2" style={{ color: "rgba(245, 230, 208, 0.3)" }}>
                    +{compare.only_me.length - 10} more
                  </p>
                )}
              </Section>
            )}

            {/* Only them */}
            {compare.only_them.length > 0 && (
              <Section title={`Only ${friend?.username ?? "They"} Has`}>
                {compare.only_them.slice(0, 10).map((beer) => (
                  <BeerRow key={beer.id} beer={beer} />
                ))}
                {compare.only_them.length > 10 && (
                  <p className="text-xs text-center py-2" style={{ color: "rgba(245, 230, 208, 0.3)" }}>
                    +{compare.only_them.length - 10} more
                  </p>
                )}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  accent,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 text-center"
      style={{
        background: accent
          ? "rgba(212, 165, 74, 0.08)"
          : "rgba(35, 26, 14, 0.7)",
        border: `1px solid ${accent ? "rgba(212, 165, 74, 0.2)" : "rgba(74, 56, 35, 0.4)"}`,
      }}
    >
      <p
        className="text-2xl font-bold"
        style={{ color: accent ? "var(--gold-accent)" : "var(--foreground)" }}
      >
        {value}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "rgba(245, 230, 208, 0.4)" }}>
        {label}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold mb-2 px-1" style={{ color: "rgba(245, 230, 208, 0.5)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function BeerRow({ beer }: { beer: { id: string; name: string; brewery: string } }) {
  return (
    <Link
      href={`/beer/${beer.id}`}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1.5"
      style={{ background: "rgba(35, 26, 14, 0.5)" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
          {beer.name}
        </p>
        <p className="text-[10px]" style={{ color: "rgba(245, 230, 208, 0.35)" }}>
          {beer.brewery}
        </p>
      </div>
      <span className="text-xs" style={{ color: "rgba(245, 230, 208, 0.25)" }}>→</span>
    </Link>
  );
}
