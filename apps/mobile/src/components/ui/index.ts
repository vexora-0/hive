/**
 * UI Atom Components — barrel export
 *
 * The whole interface vocabulary, in nine pieces. A screen that needs something
 * these do not cover should say so out loud — a tenth hand-rolled surface is
 * how a design system ends up with four radii, three shadows and two greys that
 * are nearly the same.
 *
 * | Component          | Use it for                                            |
 * |--------------------|-------------------------------------------------------|
 * | `Text`             | Every word. Picks family, size, leading and tracking.  |
 * | `Button`           | A decision. Marigold surface, ink label, key travel.   |
 * | `TextInput`        | A recessed well to write into.                         |
 * | `Card` / `Divider` | Paper resting on the page — including every list row.  |
 * | `Badge`            | A status stamp. Wash ground, text-grade label.         |
 * | `Avatar`           | A person. Portrait, or initials on their own wash.     |
 * | `Chip`             | A labelled filter or tag, optionally with a count.     |
 * | `SegmentedControl` | One choice from two or three. Never four.              |
 * | `SectionHeader`    | The name of a region, and its one trailing action.     |
 *
 * ```ts
 * import { Text, Button, Card, Chip, SectionHeader } from '@/components/ui';
 * ```
 */

export { Text, type TextProps, type TextVariant } from './Text';
export {
  Button,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
  type ButtonIcon,
} from './Button';
export { TextInput, type TextInputProps } from './TextInput';
export {
  Card,
  Divider,
  type CardProps,
  type CardElevation,
  type CardTone,
} from './Card';
export { Badge, type BadgeProps, type BadgeVariant, type BadgeSize } from './Badge';
export { Avatar, type AvatarProps, type AvatarSize } from './Avatar';
export { Chip, type ChipProps } from './Chip';
export {
  SegmentedControl,
  MAX_SEGMENTS,
  type SegmentedControlProps,
  type SegmentOption,
} from './SegmentedControl';
export {
  SectionHeader,
  type SectionHeaderProps,
  type SectionHeaderSize,
} from './SectionHeader';
