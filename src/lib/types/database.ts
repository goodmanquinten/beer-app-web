export interface UserProfile {
  id: string;
  username: string;
  email?: string | null;
  avatar_url: string | null;
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
  status: "pending" | "accepted" | "declined";
  created_at: string;
}
