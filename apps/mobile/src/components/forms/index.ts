/**
 * Form Components — barrel export
 *
 * The four controls that take input from a person rather than presenting
 * something to one. Two of them — `ClassSelector` and `StudentTagger` — present
 * their choices in `@/components/feedback/BottomSheet` and hold no sheet chrome
 * of their own.
 *
 * ```ts
 * import { ClassSelector, StudentTagger, ChildSwitcher, OTPInput } from '@/components/forms';
 * ```
 */

export { OTPInput } from './OTPInput';
export type { OTPInputProps, OTPInputHandle } from './OTPInput';

export { ClassSelector } from './ClassSelector';
export type { ClassSelectorProps, ClassItem } from './ClassSelector';

export { ChildSwitcher } from './ChildSwitcher';
export type { ChildSwitcherProps, ChildItem } from './ChildSwitcher';

export { StudentTagger } from './StudentTagger';
export type { StudentTaggerProps, StudentItem } from './StudentTagger';
