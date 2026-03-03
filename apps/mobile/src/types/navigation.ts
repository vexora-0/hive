import type { UserRole } from './supabase';

export type RootStackParamList = {
  '(auth)': undefined;
  '(teacher)': undefined;
  '(parent)': undefined;
  '(admin)': undefined;
};

export type AuthStackParamList = {
  login: undefined;
  'verify-otp': { email: string; role?: 'teacher' | 'parent' };
  onboarding: undefined;
};

export type TeacherTabParamList = {
  dashboard: undefined;
  upload: undefined;
  notifications: undefined;
  profile: undefined;
};

export type ParentTabParamList = {
  feed: undefined;
  orders: undefined;
  notifications: undefined;
  profile: undefined;
  'photo/[id]': { id: string };
};

export type AdminTabParamList = {
  dashboard: undefined;
  users: undefined;
  schools: undefined;
  notifications: undefined;
  profile: undefined;
};

export function getRoleRoute(role: UserRole): string {
  switch (role) {
    case 'teacher':
      return '/(teacher)/dashboard';
    case 'parent':
      return '/(parent)/feed';
    case 'admin':
      return '/(admin)/dashboard';
  }
}
