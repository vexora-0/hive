import { describe, it, expect } from 'vitest';

import { getRoleEquivalentRoute, getRoleRoute } from '@/types/navigation';

/**
 * The route-group collision.
 *
 * A group directory contributes nothing to the URL, so `(admin)/orders` and
 * `(parent)/orders` both answer to `/orders`, and `notifications` and `profile`
 * exist in all three groups. Expo Router breaks the tie by route order and
 * `(admin)` sorts first, so a parent cold-loading `/orders` mounted the *admin*
 * screen, `RoleGate` rejected them, and they landed on the feed instead of
 * their orders. Tab navigation never showed it, because tapping a tab targets a
 * screen inside the already-mounted group rather than resolving a URL.
 *
 * `getRoleEquivalentRoute` re-qualifies the matched screen to the caller's own
 * group. Against the pre-fix behaviour — no such function, the gate redirecting
 * straight to `getRoleRoute(role)` — every "keeps the screen" case below fails.
 */
describe('getRoleEquivalentRoute', () => {
  describe('re-qualifies a collided screen to the caller’s own group', () => {
    // Every cross-group pair in GROUP_ROUTES. The first column is the group the
    // router actually matched; the second is who is asking.
    const cases: Array<[matched: string, role: 'teacher' | 'parent' | 'admin', expected: string]> = [
      // `orders` — the collision that was actually reported.
      ['(admin)', 'parent', '/(parent)/orders'],
      ['(parent)', 'admin', '/(admin)/orders'],

      // `dashboard` — teacher and admin.
      ['(admin)', 'teacher', '/(teacher)/dashboard'],
      ['(teacher)', 'admin', '/(admin)/dashboard'],

      // `notifications` — all three groups have one.
      ['(admin)', 'teacher', '/(teacher)/notifications'],
      ['(admin)', 'parent', '/(parent)/notifications'],
      ['(teacher)', 'parent', '/(parent)/notifications'],
      ['(teacher)', 'admin', '/(admin)/notifications'],
      ['(parent)', 'teacher', '/(teacher)/notifications'],
      ['(parent)', 'admin', '/(admin)/notifications'],

      // `profile` — likewise.
      ['(admin)', 'teacher', '/(teacher)/profile'],
      ['(admin)', 'parent', '/(parent)/profile'],
      ['(teacher)', 'parent', '/(parent)/profile'],
      ['(teacher)', 'admin', '/(admin)/profile'],
      ['(parent)', 'teacher', '/(teacher)/profile'],
      ['(parent)', 'admin', '/(admin)/profile'],
    ];

    for (const [matched, role, expected] of cases) {
      const screen = expected.split('/')[2];
      it(`${matched}/${screen} asked for by ${role === 'admin' ? 'an' : 'a'} ${role} → ${expected}`, () => {
        expect(getRoleEquivalentRoute(role, [matched, screen])).toBe(expected);
      });
    }
  });

  describe('returns null so the caller falls back to the role home', () => {
    it('when the screen has no equivalent in the caller’s group', () => {
      // `upload` is teacher-only; a parent who lands there has nowhere
      // equivalent to go.
      expect(getRoleEquivalentRoute('parent', ['(teacher)', 'upload'])).toBeNull();
      // `feed` is parent-only.
      expect(getRoleEquivalentRoute('teacher', ['(parent)', 'feed'])).toBeNull();
      expect(getRoleEquivalentRoute('admin', ['(parent)', 'feed'])).toBeNull();
      // `users`, `schools` and `class-detail` are admin-only.
      expect(getRoleEquivalentRoute('teacher', ['(admin)', 'users'])).toBeNull();
      expect(getRoleEquivalentRoute('parent', ['(admin)', 'schools'])).toBeNull();
      expect(getRoleEquivalentRoute('teacher', ['(admin)', 'class-detail'])).toBeNull();
    });

    it('for a nested dynamic screen such as photo/[id]', () => {
      // Three segments, and the id is not reconstructible from them — the
      // function only handles a single screen directly under a group.
      expect(
        getRoleEquivalentRoute('parent', ['(parent)', 'photo', '[id]']),
      ).toBeNull();
      expect(
        getRoleEquivalentRoute('teacher', ['(parent)', 'photo', '[id]']),
      ).toBeNull();
    });

    it('when the matched group is already the caller’s own', () => {
      // Nothing to rewrite: the router resolved to the right file, and
      // returning a route here would make the gate redirect to the screen it is
      // already on.
      expect(getRoleEquivalentRoute('parent', ['(parent)', 'orders'])).toBeNull();
      expect(getRoleEquivalentRoute('admin', ['(admin)', 'orders'])).toBeNull();
      expect(getRoleEquivalentRoute('teacher', ['(teacher)', 'dashboard'])).toBeNull();
    });

    it('when the first segment is not a group', () => {
      expect(getRoleEquivalentRoute('parent', ['orders', 'detail'])).toBeNull();
      expect(getRoleEquivalentRoute('admin', ['admin', 'orders'])).toBeNull();
    });

    it('for a segment list that is not exactly group + screen', () => {
      expect(getRoleEquivalentRoute('parent', [])).toBeNull();
      expect(getRoleEquivalentRoute('parent', ['(admin)'])).toBeNull();
    });
  });
});

describe('getRoleRoute', () => {
  // The fallback the gate uses when getRoleEquivalentRoute returns null, and
  // the thing the collision bug sent every parent to.
  it('sends each role to its own home screen', () => {
    expect(getRoleRoute('teacher')).toBe('/(teacher)/dashboard');
    expect(getRoleRoute('parent')).toBe('/(parent)/feed');
    expect(getRoleRoute('admin')).toBe('/(admin)/dashboard');
  });
});
