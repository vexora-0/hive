import { describe, it, expect } from 'vitest';

import { formatOrderNumber } from '@/features/orders/utils/orderNumber';

/**
 * Every order screen used to render `id.slice(0, 8)`. The seeded demo orders
 * are allocated with a shared prefix — `f0000000-0000-4000-8000-00000000000N`
 * — so all of them displayed `#F0000000`: the list, the detail header and the
 * accessibility label each showed the same number for visibly different orders.
 *
 * The fix takes four hex characters from each end, so anything that differs
 * anywhere in the UUID differs on screen.
 */
describe('formatOrderNumber', () => {
  const seeded = (n: number) => `f0000000-0000-4000-8000-00000000000${n}`;

  it('gives the seeded demo orders distinct numbers', () => {
    // The regression case, stated exactly. Under `id.slice(0, 8)` every one of
    // these is 'F0000000' and the Set has one member.
    const numbers = [1, 2, 3, 4, 5].map((n) => formatOrderNumber(seeded(n)));

    expect(new Set(numbers).size).toBe(5);
    expect(numbers).toEqual(['F0000001', 'F0000002', 'F0000003', 'F0000004', 'F0000005']);
  });

  it('is not the first eight characters of the id', () => {
    // Stated independently of the seed data: two ids sharing a prefix but
    // differing at the end must not collide.
    const a = 'f0000000-0000-4000-8000-000000000001';
    const b = 'f0000000-0000-4000-8000-000000000002';

    expect(formatOrderNumber(a)).not.toBe(formatOrderNumber(b));
    expect(formatOrderNumber(a)).not.toBe(a.slice(0, 8).toUpperCase());
  });

  it('still distinguishes ids that differ only at the front', () => {
    // The other half of "both ends matter" — the property the old
    // implementation did have, which the fix must not lose.
    expect(formatOrderNumber('a1b2c3d4-0000-4000-8000-000000000001')).toBe('A1B20001');
    expect(formatOrderNumber('e5f60708-0000-4000-8000-000000000001')).toBe('E5F60001');
  });

  it('produces eight uppercase hex characters', () => {
    const number = formatOrderNumber('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    expect(number).toBe('3F253301');
    expect(number).toMatch(/^[0-9A-F]{8}$/);
  });

  it('ignores hyphen placement, taking the ends of the hex payload', () => {
    // The dashes are stripped first, so a UUID written without them formats
    // identically.
    expect(formatOrderNumber('3f2504e04f8941d39a0c0305e82c3301')).toBe('3F253301');
  });

  it('returns what it has for an id shorter than eight hex characters', () => {
    // Defensive: never seen from the API, but the function must not return
    // something misleading like a padded or re-wrapped string.
    expect(formatOrderNumber('ab-cd')).toBe('ABCD');
    expect(formatOrderNumber('')).toBe('');
  });
});
