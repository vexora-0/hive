import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { play, spacing, radius, travel } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/animation/Reveal';
import { Bo, SpeechBubble, type BoPose } from '@/components/mascot';
import { Doodle, type DoodleKind } from '@/components/decor';

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
 * Which subject the drawing is about, by what it depicts rather than by which
 * screen uses it. Named keys rather than a node, so a screen never imports a
 * drawing and no screen can quietly introduce a seventh one.
 *
 * **These used to name six line-art spot illustrations. They now name six of
 * Bo's poses** — the key set is unchanged so the twelve screens passing them
 * keep working, and every one of them means the same thing it did before. See
 * `SUBJECT_POSE` below for the mapping and the reasoning.
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
// Variant → the drawing
//
// This is where the revamp lands hardest, because it is the component that
// twelve screens use to say "there is nothing here", and a parent opening Hive
// on a quiet week meets it more often than they meet a photograph.
//
// What was here before was a geometric line drawing on a 120 grid — an empty
// paper mount lying five degrees askew, a magnifier, an open window. They were
// carefully made and they were the right answer to the question the old design
// was asking. They were also, on a product for the families of four-year-olds,
// indistinguishable from a diagram: the same austere ink line at the same
// weight whether the news was good, neutral or bad.
//
// Bo answers it better, because an empty state's real job is *tone*. Asleep
// means nothing has happened yet and that is fine. A shrug means we looked. A
// frown means it broke and we know. Those three read instantly, at any size,
// to somebody who is not reading carefully — which is everybody looking at an
// empty screen.
// ---------------------------------------------------------------------------

/**
 * The pose each subject maps to, and why each one is not interchangeable.
 *
 * `album` — asleep. Nothing has happened yet; the app is resting, not broken.
 * `prints` — carrying a print. It is the thing the screen is about.
 * `plane` — waving. An empty inbox is a greeting, not a failure.
 * `school` — pointing. An unassigned teacher needs to be sent somewhere.
 * `window` — sad. This one is always a failure to reach something.
 * `search` — shrugging. We looked; it is not that nothing exists.
 */
const SUBJECT_POSE: Record<EmptyStateIllustration, BoPose> = {
  album: 'sleep',
  prints: 'carry',
  plane: 'wave',
  school: 'point',
  window: 'sad',
  search: 'shrug',
};

/**
 * The default subject for each state.
 *
 * The old mapping's logic is preserved exactly: a magnifier for "no photos yet"
 * would have quietly promised a parent that a photo of their child exists
 * somewhere behind a filter, and a shrugging Bo would make the same promise.
 */
const DEFAULT_ILLUSTRATION: Record<EmptyStateVariant, EmptyStateIllustration> = {
  'first-use': 'album',
  filtered: 'search',
  error: 'window',
};

/**
 * The mark drawn behind Bo, and the one place the three states differ visually
 * beyond her face.
 *
 * A rainbow behind a first-use state says *something good is coming*. A cloud
 * behind an error says the opposite without saying it twice. `filtered` gets
 * nothing: the person is mid-task and a decoration behind a shrug is the app
 * being whimsical at somebody who wants their photos back.
 */
const BACKDROP: Record<EmptyStateVariant, DoodleKind | null> = {
  'first-use': 'rainbow',
  filtered: null,
  error: 'cloud',
};

/** The colour of that mark. Muted, always — it sits behind a character. */
const BACKDROP_TINT: Record<EmptyStateVariant, string> = {
  'first-use': play.honey.base,
  filtered: play.honey.base,
  error: play.sky.base,
};

/**
 * The one line Bo says, per state.
 *
 * **Not the title.** The title is the fact ("No photos yet."); the bubble is
 * the reassurance, and a bubble that repeats the heading is two of the same
 * sentence stacked. `first-use` gets one because it is the state that most
 * needs a friendly voice; `error` gets one because an apology sounds better
 * from somebody than from a system. `filtered` gets none — the person is
 * working, and a mascot commenting on their filter is in the way.
 */
const BO_SAYS: Record<EmptyStateVariant, string | null> = {
  'first-use': 'Nothing yet — I’ll keep watch.',
  filtered: null,
  error: 'That’s on us, not you.',
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

  const subject = illustration ?? DEFAULT_ILLUSTRATION[resolved];
  const pose = SUBJECT_POSE[subject];
  const backdrop = BACKDROP[resolved];
  const says = BO_SAYS[resolved];

  return (
    <View
      style={[styles.container, compact && styles.containerCompact]}
      // Android announces the state on arrival; an error that only appears
      // silently is the failure this component exists to stop.
      accessibilityLiveRegion={resolved === 'error' ? 'polite' : 'none'}
    >
      {/* No drawing in the compact form: a mascot beside existing content is
          decoration, and the language allows one per screen. */}
      {!compact && (
        <Reveal scale distance={travel.section} style={styles.stage}>
          {backdrop && (
            <Doodle
              kind={backdrop}
              // Wider than the stage on purpose: the arc has to reach past Bo
              // on both sides or the disc behind her swallows it and all that
              // survives is a smudge of colour at her shoulders.
              size={228}
              color={BACKDROP_TINT[resolved]}
              opacity={0.4}
              style={styles.backdrop}
            />
          )}

          {/* The honey disc gives Bo something to stand on. Without it she
              floats in the middle of a cream page and the composition has no
              centre — which is the same defect the flat background had, one
              element smaller. */}
          <View style={styles.disc} />

          <Bo
            pose={pose}
            size={126}
            // Bo is decorative: the title and the sentence below carry every
            // bit of the meaning, and a screen reader announcing "image" here
            // would be noise between the two things that matter.
            animated={resolved !== 'error'}
          />
        </Reveal>
      )}

      {!compact && says && (
        <SpeechBubble tail="top" tailAt={0.5} delay={320} style={styles.bubble}>
          {says}
        </SpeechBubble>
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
  /**
   * The stage Bo stands on: doodle behind, disc under, character on top.
   *
   * Sized to Bo (126) plus room for the mark behind her, and **no taller**. It
   * was 188 square, which left 30pt of empty stage under her feet that the
   * speech bubble's tail then had to reach up through — so the tail appeared to
   * be piercing her legs rather than pointing at her.
   */
  stage: {
    width: 228,
    height: 150,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    // Sits low and behind, so Bo breaks its arc rather than being framed by it.
    // A mark she is centred inside reads as a badge.
    bottom: 6,
  },
  disc: {
    position: 'absolute',
    bottom: 0,
    width: 132,
    height: 132,
    borderRadius: radius.pill,
    backgroundColor: play.honey.soft,
    opacity: 0.62,
  },
  bubble: {
    alignSelf: 'center',
    // Clear of her feet, and narrow enough to read as a spoken line rather than
    // as a second paragraph. Unbounded it stretched the width of the panel and
    // competed with the title underneath it, which is the sentence that
    // actually matters.
    maxWidth: 260,
    marginTop: spacing.ms,
    marginBottom: spacing.lg,
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
