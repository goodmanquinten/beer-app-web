import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/actions/auth";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let error = null;

  if (!user) {
    error = "Not authenticated";
  } else {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
    if (profileError) error = profileError.message;
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {profile && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-3">
          <div>
            <p className="text-sm text-gray-500">Username</p>
            <p className="font-medium text-gray-900">@{profile.username}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Member since</p>
            <p className="font-medium text-gray-900">
              {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-red-600 font-medium hover:bg-red-100"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
