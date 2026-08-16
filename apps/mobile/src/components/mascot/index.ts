/**
 * Bo — the Hive bee.
 *
 * The app's guide. She introduces the product, covers her eyes at the password
 * field, sleeps on a screen where nothing has happened yet, and cheers when a
 * print is ordered.
 *
 * ```tsx
 * import { Bo, MascotGuide, SpeechBubble, BoLoader } from '@/components/mascot';
 * ```
 *
 * **One Bo per screen.** She is a character, and a character who is in every
 * corner of every screen at once is wallpaper. If a screen seems to want two,
 * what it actually wants is one Bo and a doodle — see `@/components/decor`.
 */

export { Bo } from './Bo';
export type { BoPose, BoProps } from './Bo';

export { SpeechBubble } from './SpeechBubble';
export type { SpeechBubbleProps, TailSide } from './SpeechBubble';

export { MascotGuide } from './MascotGuide';
export type { MascotGuideProps } from './MascotGuide';

export { BoLoader } from './BoLoader';
export type { BoLoaderProps } from './BoLoader';
