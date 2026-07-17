/**
 * Database types for the `public` schema.
 *
 * Regenerated from `supabase/migrations/00001`–`00016`.
 *
 * The structure follows the shape emitted by `supabase gen types typescript`:
 * every table carries `Row`, `Insert`, `Update` and `Relationships`, and the
 * schema carries `Views`, `Functions`, `Enums` and `CompositeTypes`. That shape
 * is not cosmetic — `@supabase/postgrest-js` requires it for `GenericSchema`,
 * and a schema that fails to satisfy it makes every query row resolve to
 * `never`.
 *
 * Deliberate divergence from raw CLI output: the columns below constrained by a
 * Postgres CHECK rather than a native enum (`profiles.role`, `photos.status`,
 * `orders.status`, `order_items.product_type`, `notifications.type`) are typed
 * as the narrow unions exported at the top of this file. The CLI emits them as
 * bare `string`, which would lose the compile-time checking the app relies on.
 * Keep the unions in step with the CHECK constraints in the migrations.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---------------------------------------------------------------------------
// Domain unions — mirror the CHECK constraints in the migrations
// ---------------------------------------------------------------------------

/** `profiles.role` — 00003 */
export type UserRole = 'teacher' | 'parent' | 'admin';
/** `photos.status` — 00007 */
export type PhotoStatus = 'processing' | 'ready' | 'failed' | 'archived';
/** `orders.status` — 00009 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';
/** `order_items.product_type` — 00009 */
export type ProductType =
  | 'print_4x6'
  | 'print_5x7'
  | 'print_8x10'
  | 'digital_download'
  | 'photo_book'
  | 'magnet'
  | 'mug';
/** `notifications.type` — 00010 */
export type NotificationType = 'new_photos' | 'upload_complete' | 'new_order' | 'order_status';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          phone: string | null;
          logo_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          school_id: string | null;
          avatar_url: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          school_id?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          school_id?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      classes: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          grade: string | null;
          teacher_id: string | null;
          academic_year: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          grade?: string | null;
          teacher_id?: string | null;
          academic_year?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          grade?: string | null;
          teacher_id?: string | null;
          academic_year?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'classes_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'classes_teacher_id_fkey';
            columns: ['teacher_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      students: {
        Row: {
          id: string;
          school_id: string;
          class_id: string | null;
          full_name: string;
          date_of_birth: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          class_id?: string | null;
          full_name: string;
          date_of_birth?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          class_id?: string | null;
          full_name?: string;
          date_of_birth?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'students_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'students_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
        ];
      };
      parent_student_mappings: {
        Row: {
          id: string;
          parent_id: string;
          student_id: string;
          relationship: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          student_id: string;
          relationship?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          student_id?: string;
          relationship?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parent_student_mappings_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'parent_student_mappings_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
        ];
      };
      photos: {
        Row: {
          id: string;
          school_id: string;
          class_id: string;
          uploaded_by: string;
          s3_key: string;
          thumbnail_s3_key: string | null;
          original_filename: string | null;
          mime_type: string;
          file_size_bytes: number | null;
          width: number | null;
          height: number | null;
          /** Nullable since 00016 — client-side hashing was dropped. */
          sha256_hash: string | null;
          blurhash: string | null;
          caption: string | null;
          status: PhotoStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          class_id: string;
          uploaded_by: string;
          s3_key: string;
          thumbnail_s3_key?: string | null;
          original_filename?: string | null;
          mime_type?: string;
          file_size_bytes?: number | null;
          width?: number | null;
          height?: number | null;
          sha256_hash?: string | null;
          blurhash?: string | null;
          caption?: string | null;
          status?: PhotoStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          class_id?: string;
          uploaded_by?: string;
          s3_key?: string;
          thumbnail_s3_key?: string | null;
          original_filename?: string | null;
          mime_type?: string;
          file_size_bytes?: number | null;
          width?: number | null;
          height?: number | null;
          sha256_hash?: string | null;
          blurhash?: string | null;
          caption?: string | null;
          status?: PhotoStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'photos_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photos_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photos_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      photo_student_tags: {
        Row: {
          id: string;
          photo_id: string;
          student_id: string;
          tagged_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          photo_id: string;
          student_id: string;
          tagged_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          photo_id?: string;
          student_id?: string;
          tagged_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'photo_student_tags_photo_id_fkey';
            columns: ['photo_id'];
            isOneToOne: false;
            referencedRelation: 'photos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photo_student_tags_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photo_student_tags_tagged_by_fkey';
            columns: ['tagged_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          parent_id: string;
          school_id: string;
          idempotency_key: string;
          status: OrderStatus;
          total_cents: number;
          shipping_address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          school_id: string;
          idempotency_key: string;
          status?: OrderStatus;
          total_cents?: number;
          shipping_address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          school_id?: string;
          idempotency_key?: string;
          status?: OrderStatus;
          total_cents?: number;
          shipping_address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          photo_id: string;
          product_type: ProductType;
          quantity: number;
          unit_price_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          photo_id: string;
          product_type: ProductType;
          quantity?: number;
          unit_price_cents: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          photo_id?: string;
          product_type?: ProductType;
          quantity?: number;
          unit_price?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_photo_id_fkey';
            columns: ['photo_id'];
            isOneToOne: false;
            referencedRelation: 'photos';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          data: Json;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body?: string | null;
          data?: Json;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string | null;
          data?: Json;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_my_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_my_school_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_parent_of: {
        Args: { student_uuid: string };
        Returns: boolean;
      };
      get_my_student_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ---------------------------------------------------------------------------
// Convenience aliases
// ---------------------------------------------------------------------------

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
