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
  diary: undefined;
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
      // The diary, not the wall. A parent's home is their child's story so
      // far; the wall is a tab away and answers a narrower question.
      return '/(parent)/diary';
    case 'admin':
      return '/(admin)/dashboard';
  }
}

/** The router group directory that holds each role's screens. */
const ROLE_GROUP: Record<UserRole, string> = {
  teacher: '(teacher)',
  parent: '(parent)',
  admin: '(admin)',
};

/**
 * The screens that exist directly inside each role's group.
 *
 * Kept as a value, not just the types above, because it has to be searched at
 * runtime — see `getRoleEquivalentRoute`. If a screen is added to a group and
 * not listed here the only cost is that a cold deep link to it falls back to
 * the role's home screen, which is what happens today.
 */
const GROUP_ROUTES: Record<UserRole, readonly string[]> = {
  teacher: ['dashboard', 'upload', 'notifications', 'profile'],
  parent: ['diary', 'feed', 'orders', 'notifications', 'profile'],
  admin: [
    'dashboard',
    'orders',
    'users',
    'schools',
    'class-detail',
    'notifications',
    'profile',
  ],
};

/**
 * The route this user's own group offers for the screen they asked for.
 *
 * Several screen names exist in more than one group — `orders` in both
 * `(admin)` and `(parent)`, `notifications` and `profile` in all three. A group
 * contributes nothing to the URL, so all of those collapse onto one path:
 * `/orders` matches two files. Expo Router resolves the ambiguity by route
 * order, and `(admin)` sorts first, so a cold page load of `/orders` mounted
 * the *admin* screen; `<RoleGate allow={['admin']}>` then bounced the parent to
 * their home and they landed on the feed. Tab navigation was unaffected because
 * it targets a screen inside the already-mounted group rather than resolving a
 * URL.
 *
 * Given the segments the router actually matched, this returns the same screen
 * qualified to the user's own group, so the deep link survives. Returns null
 * when that group has no such screen — the caller then falls back to the
 * role's home.
 *
 * Only a single screen directly under a group is handled: anything deeper is
 * dynamic (`photo/[id]`), and its params are not in the segments to rebuild.
 */
export function getRoleEquivalentRoute(
  role: UserRole,
  segments: readonly string[],
): string | null {
  if (segments.length !== 2) return null;

  const [group, screen] = segments;
  if (!group.startsWith('(')) return null;
  if (group === ROLE_GROUP[role]) return null;
  if (!GROUP_ROUTES[role].includes(screen)) return null;

  return `/${ROLE_GROUP[role]}/${screen}`;
}
