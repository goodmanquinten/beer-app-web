export interface UserProfile {
  id: string;
  username: string;
  email?: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface Beer {
  id: string;
  name: string;
  brewery: string;
  style: string;
  abv: number | null;
  image_url: string | null;
  created_at: string;
  created_by: string;
}

export interface BeerEntry {
  id: string;
  user_id: string;
  beer_id: string;
  notes: string | null;
  location: string | null;
  created_at: string;
  // joined fields
  beer?: Beer;
  rating?: Rating;
  profile?: UserProfile;
}

export interface Rating {
  id: string;
  entry_id: string;
  user_id: string;
  score: number; // 1-5
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined" | "canceled";
  created_at: string;
  responded_at: string | null;
  // joined fields
  requester?: UserProfile;
  addressee?: UserProfile;
}

export type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "friends";

export interface Activity {
  id: string;
  actor_id: string;
  type: "beer_logged" | "beer_rated" | "milestone_reached";
  object_type: string | null; // "beer", "milestone", etc.
  object_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // joined fields
  actor?: UserProfile;
  beer?: Beer;
  reactions?: ActivityReaction[];
  comments?: ActivityComment[];
  reaction_count?: number;
  comment_count?: number;
  user_reacted?: boolean;
}

export interface ActivityReaction {
  id: string;
  activity_id: string;
  user_id: string;
  reaction_type: string; // "cheers" for MVP
  created_at: string;
  // joined
  user?: UserProfile;
}

export interface ActivityComment {
  id: string;
  activity_id: string;
  user_id: string;
  body: string;
  created_at: string;
  // joined
  user?: UserProfile;
}

export interface CompareResult {
  shared_beers: Beer[];
  only_me: Beer[];
  only_them: Beer[];
  overlap_pct: number;
  taste_match_pct: number | null;
  rating_disagreements: {
    beer: Beer;
    my_rating: number;
    their_rating: number;
    diff: number;
  }[];
}
