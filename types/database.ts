/**
 * Database types — kept in lock-step with supabase/migrations.
 *
 * Column names, status spellings and function signatures here are the single
 * source of truth for application code. If you change a migration, update this
 * file (or regenerate with `supabase gen types typescript --local`).
 */

export const BOOK_CONDITIONS = ["New", "Good", "Fair", "Poor"] as const;
export type BookCondition = (typeof BOOK_CONDITIONS)[number];

export const BOOK_STATUSES = ["Available", "Reserved", "Swapped", "Hidden"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export const SWAP_STATUSES = ["Pending", "Accepted", "Rejected", "Completed", "Cancelled"] as const;
export type SwapStatus = (typeof SWAP_STATUSES)[number];

export const MEETING_STATUSES = ["Suggested", "Accepted", "Rejected"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const REPORT_STATUSES = ["Open", "Reviewing", "Resolved", "Dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_REASONS = [
  "Inappropriate content",
  "Misleading listing",
  "Spam",
  "Harassment",
  "Suspected scam",
  "Other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const NOTIFICATION_TYPES = [
  "swap_request",
  "swap_accepted",
  "swap_rejected",
  "swap_cancelled",
  "swap_completed",
  "mutual_match",
  "new_message",
  "meeting_suggested",
  "meeting_accepted",
  "meeting_rejected",
  "report_update",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type UserRole = "user" | "admin";
export type MatchStatus = "Open" | "Pending" | "Accepted" | "Unavailable";
export type DiscoverSort = "newest" | "title" | "author" | "distance" | "condition";

type Timestamp = string;

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location_city: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  role: UserRole;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PublicProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location_city: string | null;
  created_at: Timestamp;
}

export interface BookRow {
  id: string;
  user_id: string;
  title: string;
  author: string;
  genre: string | null;
  condition: BookCondition;
  description: string | null;
  cover_image_url: string | null;
  google_cover_url: string | null;
  google_books_id: string | null;
  isbn: string | null;
  status: BookStatus;
  hidden_by_admin: boolean;
  reserved_by_swap_id: string | null;
  title_norm: string;
  author_norm: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface WishlistRow {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  title_norm: string;
  author_norm: string;
  created_at: Timestamp;
}

export interface SwapRequestRow {
  id: string;
  requester_id: string;
  responder_id: string;
  requested_book_id: string;
  offered_book_id: string;
  status: SwapStatus;
  note: string | null;
  requester_completed: boolean;
  responder_completed: boolean;
  responded_at: Timestamp | null;
  completed_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface MessageRow {
  id: string;
  swap_request_id: string;
  sender_id: string;
  text: string;
  created_at: Timestamp;
}

export interface MeetingLocationRow {
  id: string;
  swap_request_id: string;
  suggested_by_user_id: string;
  lat: number;
  lng: number;
  location_name: string;
  agreed_status: MeetingStatus;
  suggested_time: Timestamp | null;
  responded_at: Timestamp | null;
  created_at: Timestamp;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_swap_id: string | null;
  related_book_id: string | null;
  is_read: boolean;
  created_at: Timestamp;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_book_id: string | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  resolved_by: string | null;
  created_at: Timestamp;
  resolved_at: Timestamp | null;
}

export interface MatchRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  book_a_id: string;
  book_b_id: string;
  created_at: Timestamp;
}

export interface AiUsageRow {
  id: number;
  user_id: string;
  kind: "insights" | "question";
  created_at: Timestamp;
}

/** Row returned by public.get_my_matches(). */
export interface MatchResultRow {
  match_id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  other_user_city: string | null;
  my_book_id: string;
  my_book_title: string;
  my_book_author: string;
  my_book_cover: string | null;
  my_book_status: BookStatus;
  their_book_id: string;
  their_book_title: string;
  their_book_author: string;
  their_book_cover: string | null;
  their_book_condition: BookCondition;
  their_book_status: BookStatus;
  distance_km: number | null;
  match_status: MatchStatus;
  active_swap_id: string | null;
  created_at: Timestamp;
}

/** Row returned by public.discover_books(). */
export interface DiscoverBookRow {
  id: string;
  user_id: string;
  title: string;
  author: string;
  genre: string | null;
  condition: BookCondition;
  description: string | null;
  cover_image_url: string | null;
  google_cover_url: string | null;
  status: BookStatus;
  created_at: Timestamp;
  owner_name: string;
  owner_avatar: string | null;
  owner_city: string | null;
  distance_km: number | null;
  in_wishlist: boolean;
  is_mutual_match: boolean;
  total_count: number;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  location_city: string | null;
  role: UserRole;
  created_at: Timestamp;
  books_count: number;
  reports_against: number;
  completed_swaps: number;
}

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Optional<ProfileRow, "email" | "full_name" | "avatar_url" | "bio" | "location_city" | "geo_lat" | "geo_lng" | "role" | "created_at" | "updated_at">;
        Update: Partial<Pick<ProfileRow, "full_name" | "avatar_url" | "bio" | "location_city" | "geo_lat" | "geo_lng">>;
        Relationships: [];
      };
      books: {
        Row: BookRow;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          author: string;
          genre?: string | null;
          condition: BookCondition;
          description?: string | null;
          cover_image_url?: string | null;
          google_cover_url?: string | null;
          google_books_id?: string | null;
          isbn?: string | null;
          status?: BookStatus;
        };
        Update: Partial<
          Pick<
            BookRow,
            | "title"
            | "author"
            | "genre"
            | "condition"
            | "description"
            | "cover_image_url"
            | "google_cover_url"
            | "google_books_id"
            | "isbn"
            | "status"
          >
        >;
        Relationships: [
          { foreignKeyName: "books_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "books_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "public_profiles"; referencedColumns: ["id"] },
        ];
      };
      wishlists: {
        Row: WishlistRow;
        Insert: { id?: string; user_id: string; title: string; author?: string | null };
        Update: never;
        Relationships: [];
      };
      swap_requests: {
        Row: SwapRequestRow;
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: "swap_requests_requested_book_id_fkey"; columns: ["requested_book_id"]; isOneToOne: false; referencedRelation: "books"; referencedColumns: ["id"] },
          { foreignKeyName: "swap_requests_offered_book_id_fkey"; columns: ["offered_book_id"]; isOneToOne: false; referencedRelation: "books"; referencedColumns: ["id"] },
        ];
      };
      messages: {
        Row: MessageRow;
        Insert: { swap_request_id: string; sender_id: string; text: string };
        Update: never;
        Relationships: [];
      };
      meeting_locations: {
        Row: MeetingLocationRow;
        Insert: {
          swap_request_id: string;
          suggested_by_user_id: string;
          lat: number;
          lng: number;
          location_name: string;
          suggested_time?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: never;
        Update: { is_read?: boolean };
        Relationships: [];
      };
      reports: {
        Row: ReportRow;
        Insert: {
          reporter_id: string;
          reported_user_id?: string | null;
          reported_book_id?: string | null;
          reason: ReportReason;
          description?: string | null;
        };
        Update: never;
        Relationships: [
          { foreignKeyName: "reports_reported_book_id_fkey"; columns: ["reported_book_id"]; isOneToOne: false; referencedRelation: "books"; referencedColumns: ["id"] },
        ];
      };
      matches: {
        Row: MatchRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ai_usage: {
        Row: AiUsageRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: PublicProfileRow;
        Relationships: [];
      };
    };
    Functions: {
      create_swap_request: {
        Args: { p_requested_book_id: string; p_offered_book_id: string; p_note?: string | null };
        Returns: string;
      };
      accept_swap_request: { Args: { p_swap_id: string }; Returns: SwapRequestRow };
      reject_swap_request: { Args: { p_swap_id: string }; Returns: SwapRequestRow };
      cancel_swap_request: { Args: { p_swap_id: string }; Returns: SwapRequestRow };
      complete_swap: { Args: { p_swap_id: string }; Returns: SwapRequestRow };
      respond_meeting_location: {
        Args: { p_meeting_id: string; p_accept: boolean };
        Returns: MeetingLocationRow;
      };
      get_my_matches: { Args: Record<string, never>; Returns: MatchResultRow[] };
      discover_books: {
        Args: {
          p_query?: string | null;
          p_genre?: string | null;
          p_condition?: string | null;
          p_status?: string | null;
          p_max_distance_km?: number | null;
          p_sort?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: DiscoverBookRow[];
      };
      approx_distance_km: { Args: { p_other_user_id: string }; Returns: number | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      consume_ai_quota: { Args: { p_kind: string; p_limit_per_hour?: number }; Returns: boolean };
      admin_update_report: {
        Args: { p_report_id: string; p_status: string; p_notes?: string | null };
        Returns: ReportRow;
      };
      admin_set_book_visibility: { Args: { p_book_id: string; p_hidden: boolean }; Returns: BookRow };
      admin_get_user: { Args: { p_user_id: string }; Returns: AdminUserRow[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type { Rel as DatabaseRelationship };
