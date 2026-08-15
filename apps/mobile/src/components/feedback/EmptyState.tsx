import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing, travel } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/animation/Reveal';
import {
  EmptyAlbum,
  OpenWindow,
  PaperPlane,
  SchoolGate,
  SearchGlass,
  StackOfPrints,
  type IllustrationProps,
} from '@/components/illustration';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmptyStateAction {
  /** Button label — name the action, e.g. "Try again". */
  label: string;
  /** Button press handler. */
  onPress: () => void;
}

/**
 * Why an empty state is empty. There are exactly three answers, and they are
 * not interchangeable — each one owes the person looking a different sentence
 * and a different way out.
 *
 *  - `first-use` — nothing has happened yet **and the person looking cannot
 *    make it happen.** A parent waiting on their child's teacher, an admin
 *    console before the first order arrives. **This variant takes no action**:
 *    a button that cannot fill the screen is a dead end dressed as a way out,
 *    and it teaches people that Hive's buttons do not work.
 *  - `filtered` — the data exists, a filter is hiding it. Always takes the
 *    action that clears the filter, because the way out is one tap and the
 *    person cannot see what it is.
 *  - `error` — the request failed. Always takes a retry, per the brief's rule
 *    that a failed request must never be dressed up as an empty list.
 */
export type EmptyStateVariant = 'first-use' | 'filtered' | 'error';

/**
 * Which spot illustration to draw, by what it depicts rather than by which
 * screen uses it. Named keys rather than a node, so a screen never imports a
 * drawing and no screen can quietly introduce an eighth one.
 */
export type EmptyStateIllustration =
  | 'album'
  | 'prints'
  | 'plane'
  | 'school'
  | 'window'
  | 'search';

export interface EmptyStateProps {
  /** What is not here. One short line, sentence case, with a full stop. */
  title: string;
  /** Why it is not here, and what happens next. */
  message?: string;
  /**
   * Which of the three empty states this is. See {@link EmptyStateVariant}.
   *
   * Left unset it is **inferred**: an empty state that ships an action is, by
   * the definition above, not the case where the person cannot act — so a call
   * with an `action` is read as `'error'` and one without as `'first-use'`.
   * That inference exists only so screens written before the variants keep
   * their retry buttons; every screen should say which state it is in.
   */
  variant?: EmptyStateVariant;
  /**
   * Overrides the drawing chosen by `variant`. Reach for it when the subject is
   * specific — a stack of prints for orders, a schoolhouse for an unassigned
   * teacher — and leave it alone otherwise.
   */
  illustration?: EmptyStateIllustration;
  /**
   * The way out. **Ignored when `variant` is explicitly `'first-use'`** — see
   * the note on {@link EmptyStateVariant}.
   */
  action?: EmptyStateAction;
  /**
   * The smaller inline form, for an empty region inside a populated screen.
   * **Draws no illustration**: a spot drawing on a screen that already has
   * content is decoration, which the illustration language forbids.
   */
  compact?: boolean;
  /**
   * @deprecated No longer rendered. The mark above the title is a spot
   * illustration chosen by `variant`, not an icon in a tinted tile. Kept in the
   * type so the twelve screens that pass it keep compiling; delete the prop as
   * you touch each screen.
   */
  icon?: keyof typeof Ionicons.glyphMap;
}

// ---------------------------------------------------------------------------
// Variant → drawing
// ---------------------------------------------------------------------------

const ILLUSTRATIONS = {
  album: EmptyAlbum,
  prints: StackOfPrints,
  plane: PaperPlane,
  school: SchoolGate,
  window: OpenWindow,
  search: SearchGlass,
} as const satisfies Record<
  EmptyStateIllustration,
  React.ComponentType<IllustrationProps>
>;

/**
 * The default drawing for each state, and the reason the three states exist.
 *
 * An empty mount is waiting for something; a magnifier over one says something
 * is hidden and findable; an open window says the view is still there and we
 * simply cannot reach it this second. Using the magnifier for "no photos yet"
 * would quietly promise a parent that a photo of their child exists somewhere
 * behind a filter.
 */
const DEFAULT_ILLUSTRATION: Record<EmptyStateVariant, EmptyStateIllustration> = {
  'first-use': 'album',
  filtered: 'search',
  error: 'window',
};

/**
 * The marigold layer behind the line, on the one state that should feel
 * hopeful. Filtered and error are working states: the drawing recedes and the
 * sentence does the work.
 */
const WASHED: Record<EmptyStateVariant, boolean> = {
  'first-use': true,
  filtered: false,
  error: false,
};

/**
 * A retry is the whole point of an error state, so it is the primary. Clearing
 * a filter is a correction rather than a destination — the person was already
 * browsing — so it arrives at outline weight and does not compete with
 * whatever they do next.
 */
function actionWeight(variant: EmptyStateVariant): 'primary' | 'outline' {
  return variant === 'filtered' ? 'outline' : 'primary';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<EmptyState>` — what a screen shows when it has nothing to show.
 *
 * This component sets the tone of twelve screens, most of which a parent meets
 * on a quiet week, so it is deliberately not one shape with the words swapped.
 * A screen that is empty because nothing has happened yet, one that is empty
 * because a filter is hiding everything, and one that is empty because the
 * request failed are three different situations, and the single generic "No
 * photos" panel answered all three with the same shrug.
 *
 * The mark above the title is a spot illustration rather than an icon in a
 * tinted tile. A 30px glyph in an amber square is a system telling you it has
 * no content; a paper mount lying askew is the app's own mechanism with the
 * picture missing, which is the thing the screen is actually saying.
 *
 * ```tsx
 * <EmptyState
 *   variant="first-use"
 *   title="No photos yet."
 *   message="When Aarav's teacher shares a moment, it will appear here."
 * />
 *
 * <EmptyState
 *   variant="error"
 *   title="Couldn't load photos."
 *   message="Check your connection and try again."
 *   action={{ label: 'Try again', onPress: refetch }}
 * />
 * ```
 */
export function EmptyState({
  title,
  message,
  variant,
  illustration,
  action,
  compact = false,
  // `icon` is accepted by the type and deliberately not read — see its note.
}: EmptyStateProps) {
  const resolved: EmptyStateVariant = variant ?? (action ? 'error' : 'first-use');

  // The rule is enforced here rather than trusted to twelve call sites: a
  // first-use state never renders a call to action, whatever it was handed.
  const permitsAction = resolved !== 'first-use';
  const shownAction = permitsAction ? action : undefined;

  if (__DEV__ && action && !permitsAction) {
    console.warn(
      '[EmptyState] A first-use empty state takes no action — the person ' +
        `looking cannot fill it. Dropped "${action.label}" on "${title}". ` +
        'If they can act, this is not a first-use state.',
    );
  }

  const Illustration = ILLUSTRATIONS[illustration ?? DEFAULT_ILLUSTRATION[resolved]];

  return (
    <View
      style={[styles.container, compact && styles.containerCompact]}
      // Android announces the state on arrival; an error that only appears
      // silently is the failure this component exists to stop.
      accessibilityLiveRegion={resolved === 'error' ? 'polite' : 'none'}
    >
      {/* No drawing in the compact form: an illustration beside existing
          content is decoration, and the language allows one per screen. */}
      {!compact && (
        <Reveal scale distance={travel.section} style={styles.illustration}>
          <Illustration wash={WASHED[resolved]} />
        </Reveal>
      )}

      <Reveal index={1}>
        <Text variant="h3" center accessibilityRole="header">
          {title}
        </Text>
      </Reveal>

      {message && (
        <Reveal index={2}>
          <Text variant="body" muted center style={styles.message}>
            {message}
          </Text>
        </Reveal>
      )}

      {shownAction && (
        <Reveal index={3} style={styles.actionRow}>
          <Button variant={actionWeight(resolved)} onPress={shownAction.onPress}>
            {shownAction.label}
          </Button>
        </Reveal>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  containerCompact: {
    flex: 0,
    paddingVertical: spacing.xl,
  },
  illustration: {
    marginBottom: spacing.md,
  },
  message: {
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  actionRow: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});

export default EmptyState;
