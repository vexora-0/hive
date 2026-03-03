export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'teacher' | 'parent' | 'admin';
export type PhotoStatus = 'processing' | 'ready' | 'failed' | 'archived';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type ProductType = 'print_4x6' | 'print_5x7' | 'print_8x10' | 'digital_download' | 'photo_book' | 'magnet' | 'mug';
export type NotificationType = 'new_photos' | 'upload_complete' | 'new_order' | 'order_status';

export interface Database {
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
        Insert: Omit<Database['public']['Tables']['schools']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['schools']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['classes']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['classes']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['students']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['students']['Insert']>;
      };
      parent_student_mappings: {
        Row: {
          id: string;
          parent_id: string;
          student_id: string;
          relationship: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['parent_student_mappings']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['parent_student_mappings']['Insert']>;
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
          sha256_hash: string;
          blurhash: string | null;
          caption: string | null;
          status: PhotoStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['photos']['Row'], 'id' | 'created_at' | 'updated_at' | 'status'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          status?: PhotoStatus;
        };
        Update: Partial<Database['public']['Tables']['photos']['Insert']>;
      };
      photo_student_tags: {
        Row: {
          id: string;
          photo_id: string;
          student_id: string;
          tagged_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['photo_student_tags']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['photo_student_tags']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          parent_id: string;
          school_id: string;
          idempotency_key: string;
          status: OrderStatus;
          total_amount: number;
          shipping_address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at' | 'status'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          status?: OrderStatus;
        };
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          photo_id: string;
          product_type: ProductType;
          quantity: number;
          unit_price: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at' | 'is_read'> & {
          id?: string;
          created_at?: string;
          is_read?: boolean;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
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
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
