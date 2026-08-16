import type { BoPose } from '@/components/mascot';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which composition `<SlideVignette>` draws for a slide. */
export type VignetteKind = 'feed' | 'private' | 'prints';

export interface OnboardingSlideData {
  /** Unique key for FlatList. */
  id: string;
  /** A short mark above the headline. Says where you are in the story. */
  eyebrow: string;
  /** Slide headline. */
  title: string;
  /** Supporting copy below the headline. One sentence. */
  description: string;
  /** The illustration built from the app's own photo mounts. */
  vignette: VignetteKind;
  /** What Bo is doing on this slide. */
  pose: BoPose;
  /**
   * What Bo says — **never a restatement of the headline.**
   *
   * The headline is the claim, in the product's voice. The bubble is the same
   * promise made personally, in hers, and the pair only works if they are
   * saying different things. Slide two is the clearest case: the headline
   * states the privacy boundary, and Bo, hands over her eyes, demonstrates it.
   */
  says: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/**
 * Three slides, each one demonstrating its claim rather than asserting it.
 *
 * The copy is deliberately short: this screen is between a parent and the
 * photograph they opened the app to see, and every extra clause is a reason to
 * hit Skip. The detail that used to be here — how the privacy boundary is
 * enforced — belongs in the privacy policy, not in the way.
 */
export const slides: OnboardingSlideData[] = [
  {
    id: 'capture',
    eyebrow: 'What you get',
    title: "Your child's day, as it happens",
    description:
      'Teachers share photos from class as the day goes — painting, playtime, lunch, the lot.',
    vignette: 'feed',
    pose: 'wave',
    says: 'Hi! I’m Bo. I’ll bring you the good bits.',
  },
  {
    id: 'secure',
    eyebrow: 'Who can see',
    title: 'Only your child, only you',
    description:
      "Every parent sees their own child and nobody else's. That is checked on our servers, every single time.",
    vignette: 'private',
    // The whole product promise, drawn. A parent who reads nothing on this
    // screen still sees a character with her eyes covered.
    pose: 'hide',
    says: 'Not peeking. Nobody is.',
  },
  {
    id: 'prints',
    eyebrow: 'If you want it',
    title: 'Keep the ones you love',
    description:
      'Order a print, a fridge magnet or a photo book, delivered to your door. Prints start at ₹30.',
    vignette: 'prints',
    pose: 'carry',
    says: 'Pick a favourite. I’ll post it.',
  },
];
