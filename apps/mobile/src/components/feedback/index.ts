/**
 * Feedback — the four states every screen owes the person using it.
 *
 * A list is not finished when it renders rows. It owes a **delayed skeleton**
 * while the request is out, an **empty state** that says which of the three
 * kinds of empty this is, an **error with a retry**, and the content itself.
 * The components here are those states, so that no screen has to invent them
 * and no two screens invent them differently.
 *
 * | Need | Reach for |
 * |---|---|
 * | Loading | {@link SkeletonShimmer} — waits 200ms, so a fast response never flashes grey |
 * | Loading → content | {@link SkeletonSwap} — the same, dissolving into the real thing |
 * | Nothing to show | {@link EmptyState} — pick the variant; it is not one panel with the words swapped |
 * | Request failed | {@link EmptyState} `variant="error"`, or {@link ErrorBoundary} for a crash |
 * | No connection | {@link OfflineBanner} |
 * | Something happened | {@link useToast} |
 * | Irreversible action | {@link ConfirmDialog} |
 * | A modal surface | {@link BottomSheet} — the app's one sheet |
 */

export { SkeletonShimmer, SkeletonSwap, SKELETON_DELAY } from './SkeletonShimmer';
export type { SkeletonShimmerProps, SkeletonSwapProps } from './SkeletonShimmer';

export { OfflineBanner } from './OfflineBanner';
export type { OfflineBannerProps } from './OfflineBanner';

export { EmptyState } from './EmptyState';
export type {
  EmptyStateProps,
  EmptyStateAction,
  EmptyStateVariant,
  EmptyStateIllustration,
} from './EmptyState';

export { ErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';
export { ToastProvider, useToast, ToastOutlet } from './Toast';
export { Modal } from './Modal';
export type { ModalProps } from './Modal';
export { BottomSheet } from './BottomSheet';
export type { BottomSheetProps } from './BottomSheet';
export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';
