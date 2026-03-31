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
  /** Tinted background colour for the slide. */
  backgroundColor: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const slides: OnboardingSlideData[] = [
  {
    id: 'capture',
    title: 'Capture Precious Moments',
    description:
      'Teachers snap photos of your little ones throughout the day',
    backgroundColor: colors.background.cream,
  },
  {
    id: 'secure',
    title: 'Safe & Secure',
    description:
      'Only you can see your child\u2019s photos. Privacy is our promise.',
    backgroundColor: colors.primary.blueLight,
  },
  {
    id: 'prints',
    title: 'Order Prints & More',
    description:
      'Turn your favorite moments into prints, photo books, and keepsakes',
    backgroundColor: colors.primary.mintLight,
  },
];
