import type { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingSlideData {
  /** Unique key for FlatList. */
  id: string;
  /** Slide headline. */
  title: string;
  /** Supporting copy below the headline. */
  description: string;
  /**
   * Colour of the slide's icon.
   *
   * The slides used to tint their whole background instead, which turned the
   * first three screens of the app into a colour swatch tour and fought the
   * paper ground everywhere else. The colour now lives in one 96px tile.
   */
  tint: string;
  /** Background of that tile — the wash form of `tint`. */
  wash: string;
  /**
   * Illustration for the slide.
   *
   * An icon rather than a Lottie: `assets/lottie/bee.json` is a stub — one
   * shape layer holding a single filled ellipse that rotates, with no bee in
   * it. Rendering that would look worse than the emoji it replaced. Icons are
   * themeable and render identically on both platforms, which emoji do not.
   */
  icon: keyof typeof Ionicons.glyphMap;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const slides: OnboardingSlideData[] = [
  {
    id: 'capture',
    title: "Your child's day, as it happens",
    description:
      'Teachers share photos from class through the day — painting, playtime, lunch, the lot.',
    tint: colors.primary.amber,
    wash: colors.primary.amberWash,
    icon: 'camera',
  },
  {
    id: 'secure',
    title: 'Seen only by you',
    description:
      "Every parent sees their own child and nobody else's. That boundary is enforced on our servers, not just in the app.",
    tint: colors.primary.blue,
    wash: colors.primary.blueWash,
    icon: 'lock-closed',
  },
  {
    id: 'prints',
    title: 'Keep the ones you love',
    description:
      'Turn a favourite moment into a print, a fridge magnet or a photo book. Prints start at ₹30.',
    tint: colors.primary.rose,
    wash: colors.primary.roseWash,
    icon: 'albums',
  },
];
