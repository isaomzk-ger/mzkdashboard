// ドメイン型（Supabase のテーブルに対応）

export type Role = "admin" | "manager" | "member";
export type Audience = "executive" | "employee";

export interface Organization {
  id: string;
  name: string;
  access_enabled: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string | null;
  email: string | null;
  full_name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface AllowedEmail {
  email: string;
  role: Role;
  org_id: string | null;
  active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  audience: Audience;
  sort_order: number;
  published: boolean;
  created_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
  created_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
  last_position_seconds: number;
  updated_at: string;
}

export interface CourseDeadline {
  id: string;
  org_id: string;
  user_id: string;
  course_id: string;
  due_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationCourse {
  org_id: string;
  course_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  org_id: string | null;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TeamProgress {
  user_id: string;
  full_name: string;
  completed_count: number;
  total_count: number;
  percentage: number;
}
