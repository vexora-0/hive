/**
 * The short order number shown to users, derived from an order's UUID.
 *
 * Every screen used to display `id.slice(0, 8)` — the first eight hex
 * characters. A UUID's first eight characters are not a safe identifier:
 * anything that allocates ids with a shared prefix collides outright. The
 * seeded demo orders (`f0000000-0000-4000-8000-00000000000N`) all rendered as
 * `#F0000000`, so three visibly different orders carried the same number on
 * screen and in the accessibility label.
 *
 * Taking four characters from each end keeps the same eight-character display
 * while making both ends of the UUID matter, so ids that differ anywhere
 * outside the first block now differ on screen. It is still a truncation, not
 * an identity: use `order.id` for anything that has to be unique.
 */
export function formatOrderNumber(id: string): string {
  const hex = id.replace(/-/g, '');
  if (hex.length < 8) return hex.toUpperCase();

  return (hex.slice(0, 4) + hex.slice(-4)).toUpperCase();
}

export default formatOrderNumber;
