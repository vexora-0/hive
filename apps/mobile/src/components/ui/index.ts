/**
 * UI Atom Components — barrel export
 *
 * ```ts
 * import { Text, Button, Card, Chip, SectionHeader } from '@/components/ui';
 * ```
 */

export { Text, type TextProps, type TextVariant } from './Text';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { TextInput, type TextInputProps } from './TextInput';
export {
  Card,
  Divider,
  type CardProps,
  type CardElevation,
  type CardTone,
} from './Card';
export { Badge, type BadgeProps, type BadgeVariant } from './Badge';
export { Avatar, type AvatarProps, type AvatarSize } from './Avatar';
export { Chip, type ChipProps } from './Chip';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentOption,
} from './SegmentedControl';
export { SectionHeader, type SectionHeaderProps } from './SectionHeader';
