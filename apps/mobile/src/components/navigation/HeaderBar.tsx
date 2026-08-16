import React, { useCallback, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors, play as playColors, spacing, layout, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Bo, type BoPose } from '@/components/mascot';
import { Doodle } from '@/components/decor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeaderBarAction {
  /** Ionicons icon name. One family, one weight — never a second icon set. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Press handler. */
  onPress: () => void;
  /**
   * What the button *does*, for a screen reader — "Search photos", not
   * "magnifier".
   *
   * Optional only so that adding an action to a screen never fails to compile
   * mid-edit. **Always pass one.** Without it the label falls back to the icon
   * name, which is a placeholder, not a description. If `badge` is set, say so
   * here too: a dot is invisible to VoiceOver.
   */
  accessibilityLabel?: string;
  /** Shows a dot on the icon — unread, unsaved, needs attention. */
  badge?: boolean;
}

export interface HeaderBarProps {
  /** Header title. */
  title: string;
  /**
   * A quiet line above the large title. Say something the title cannot — whose
   * photos these are, which class, how many.
   *
   * Sentence case, never shouted: "Aarav · Sunflower".
   */
  eyebrow?: string;
  /** A quiet line under the large title. */
  subtitle?: string;
  /**
   * Renders the title large, in the display face, on its own line.
   * Off by default so detail screens keep a conventional centred bar.
   */
  large?: boolean;
  /**
   * The feed's own register: the large title in `displayLight` at 40pt instead
   * of `h1` at 32.
   *
   * Fraunces Light is only legible from 32pt up, which is why it is tied to
   * this one prop rather than offered as a size. **One screen per role should
   * use it** — if every top-level screen shouts, none of them do. `large` is
   * implied.
   */
  hero?: boolean;
  /**
   * Scroll offset of the screen's list, in px. When provided, the large title
   * hands over to a compact one as the content scrolls under it.
   *
   * This is the default a top-level screen should reach for — see
   * `useHeaderScroll()`, which is the two-line way to wire it.
   */
  scrollY?: SharedValue<number>;
  /** Shows a back arrow on the left. @default false */
  showBack?: boolean;
  /** Handler for the back arrow. */
  onBack?: () => void;
  /** Left action — replaces the back arrow. */
  leftAction?: HeaderBarAction;
  /** Right action. Rendered alongside `trailing`, not instead of it. */
  rightAction?: HeaderBarAction;
  /**
   * Arbitrary content at the right of the action row — a chip, a count, an
   * avatar. Sits to the left of `rightAction` so the icon stays on the edge
   * where a thumb expects it.
   */
  trailing?: ReactNode;
  /**
   * Sets the large title in the **play voice** — Fredoka rather than Fraunces
   * — with a hand-drawn rule under it.
   *
   * **The one screen a role opens first, and nothing else.** The play voice is
   * a greeting; a greeting on every screen is not a greeting. `hero` picks the
   * 46pt cut, `large` the 30pt one.
   *
   * Ignored on the compact bar entirely: a detail screen is somewhere a person
   * navigated *to* on purpose, and it should get out of their way.
   */
  play?: boolean;
  /**
   * Draws Bo beside the large title, in this pose.
   *
   * Pair it with `play`. A mascot over a Fraunces title is two different
   * products in one header.
   */
  mascot?: BoPose;
  /**
   * Drops the header's own paper fill so a `<PlayfulBackdrop>` behind the
   * screen shows through it.
   *
   * Off by default, because a header that does not paint its own background is
   * a header that content scrolls visibly *through* — which is only acceptable
   * when there is a deliberate backdrop underneath. Pass it on the screens that
   * have one, and nowhere else.
   */
  translucent?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_HEIGHT = 52;
const ICON_SIZE = 23;
const HIT_SLOP = 10;
/** How far the list scrolls before the large title has fully handed over. */
const COLLAPSE_DISTANCE = 56;
/** Where in that distance the compact title starts arriving. */
const HANDOVER_POINT = 0.55;
/** How far the large title drifts up as it goes, in px. */
const LARGE_DRIFT = 10;
/** How far the compact title rises into place, in px. */
const COMPACT_RISE = 8;

// ---------------------------------------------------------------------------
// Scroll wiring
// ---------------------------------------------------------------------------

/**
 * The two lines a top-level screen needs to make its header collapse.
 *
 * ```tsx
 * const { scrollY, onScroll } = useHeaderScroll();
 *
 * <HeaderBar large title="Moments" eyebrow={eyebrow} scrollY={scrollY} />
 * <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}>…</Animated.ScrollView>
 * ```
 *
 * It exists because the wiring was the reason the collapse shipped on one
 * screen out of thirteen: a shared value plus a hand-written
 * `useAnimatedScrollHandler` in every screen file is three imports and six
 * lines of boilerplate that read like plumbing, so nobody added them.
 *
 * ── Which list you are on decides which handler you get ───────────────
 *
 * On an `Animated.ScrollView` this returns Reanimated's own handler and the
 * header never waits on JavaScript to find out where the list is.
 *
 * **On a FlashList it must not.** Reanimated 4's `useAnimatedScrollHandler`
 * returns an *object* (`{ workletEventHandler }`), not a function. FlashList v2
 * scrolls RN's `Animated.ScrollView` rather than Reanimated's, so nothing
 * unwraps that object, and it reaches the caller through
 * `props.onScroll?.call(props, event)` inside `RecyclerView` — where `.call`
 * is undefined and the screen throws on the first scroll. `flashList: true`
 * therefore returns a plain JS handler writing into the same shared value: one
 * hop through JavaScript per scroll event, which a header collapse absorbs
 * without a visible lag, and which is the only form FlashList can invoke.
 *
 * The previous version of this docblock recommended passing the Reanimated
 * handler straight to `MasonryGrid`, which is exactly the crash.
 */
export function useHeaderScroll(options?: { flashList?: boolean }) {
  const scrollY = useSharedValue(0);

  const reanimatedHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const jsHandler = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  return {
    scrollY,
    onScroll: options?.flashList ? jsHandler : reanimatedHandler,
  };
}

// ---------------------------------------------------------------------------
// Icon button
// ---------------------------------------------------------------------------

/**
 * Last-resort label for an action that shipped without one: "chevron-back"
 * becomes "Chevron back". It keeps the control announced rather than silent,
 * and it is deliberately literal so it reads as the placeholder it is.
 */
function labelFromIcon(icon: string): string {
  const words = icon.replace(/-(outline|sharp)$/, '').split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function IconButton({ action }: { action: HeaderBarAction }) {
  return (
    <Pressable
      onPress={action.onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
      hitSlop={HIT_SLOP}
      accessibilityLabel={action.accessibilityLabel ?? labelFromIcon(action.icon)}
      accessibilityRole="button"
    >
      <Ionicons name={action.icon} size={ICON_SIZE} color={colors.text.primary} />
      {action.badge && <View style={styles.iconDot} />}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<HeaderBar>` — the top of a screen.
 *
 * The chrome withdraws here. The header is paper, the same paper as the page,
 * with no fill, no logo and no rule until the content is genuinely sliding
 * underneath it. Every competitor in this category paints ~15% of each screen
 * in brand colour; the photograph is the only saturated thing on a Hive
 * screen, and this is the file that decides that.
 *
 * Two modes. Detail screens get the conventional centred bar. Top-level
 * screens pass `large`, which sets the title in the display face on its own
 * line — the one place per screen where Fraunces appears at full size.
 *
 * ```tsx
 * const { scrollY, onScroll } = useHeaderScroll();
 * <HeaderBar large title="Moments" eyebrow="Aarav · Sunflower" scrollY={scrollY} />
 * ```
 *
 * ── Why the header does not shrink ───────────────────────────────────
 *
 * A collapsing header that also gives its height back looks obvious and is a
 * trap while the header sits **in the layout flow above the list**, which is
 * how all thirteen screens are built. Shrinking the header by H moves the
 * list's origin up by H *on top of* the H the finger already scrolled, so the
 * content travels at roughly 2× the finger for the whole first flick — the
 * exact "this feels cheap" tell the collapse is meant to avoid.
 *
 * So the height here is constant and only the type cross-fades. The real fix
 * is to position the header absolutely and pay for it with `paddingTop` on the
 * list's content container, which is a change in every screen file rather than
 * in this one.
 *
 * What the header does instead is take up less room to begin with: the 52px
 * action row is only rendered when there is an action to put in it, and on a
 * top-level screen with no actions — which is most of them — the compact title
 * fades in over the block the large title is leaving, so a scrolled screen
 * shows a title rather than an empty band of paper.
 *
 * Everything scroll-linked below interpolates with `Extrapolation.CLAMP` and
 * **nothing scroll-linked is sprung**: a spring driven by a scroll position
 * lags the finger by its own settling time, which reads as the app being a
 * frame behind the user.
 */
export function HeaderBar({
  title,
  eyebrow,
  subtitle,
  large = false,
  hero = false,
  scrollY,
  showBack = false,
  onBack,
  leftAction,
  rightAction,
  trailing,
  play = false,
  mascot,
  translucent = false,
}: HeaderBarProps) {
  // ── Collapse ────────────────────────────────────────────────────────
  // Without a scrollY the header is static: the large block stays open and the
  // compact title stays hidden. The feed renders both forms — its loading
  // branch has no list to listen to — so every worklet has to survive the
  // value arriving late.
  /**
   * Whether the large title hands over to a compact one as the list scrolls.
   *
   * **A `play` header never collapses.** It is the one screen a role opens
   * first, and its job is to greet: the 46pt name, the hand-drawn rule under it
   * and the mascot beside it *are* the screen's identity, and trading them for
   * a 17pt word the moment somebody scrolls throws that away exactly when they
   * start using the app. It also looked wrong — the header keeps its height as
   * the type fades (see the note below on why it must), so collapsing left one
   * small word floating in a tall empty band.
   *
   * Every other large header still collapses. A detail or list screen has no
   * greeting to protect and does want its chrome to step back.
   */
  const collapses = !play;

  const largeBlockStyle = useAnimatedStyle(() => {
    if (!scrollY || !collapses) return { opacity: 1, transform: [{ translateY: 0 }] };
    const t = interpolate(
      scrollY.value,
      [0, COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: 1 - t,
      transform: [{ translateY: -t * LARGE_DRIFT }],
    };
  });

  const compactTitleStyle = useAnimatedStyle(() => {
    if (!scrollY || !collapses) return { opacity: 0 };
    const t = interpolate(
      scrollY.value,
      [COLLAPSE_DISTANCE * HANDOVER_POINT, COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * COMPACT_RISE }],
    };
  });

  // The rule only appears once content is actually sliding underneath, so a
  // screen at rest has no line across it.
  const ruleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };
    return {
      opacity: interpolate(scrollY.value, [0, 12], [0, 1], Extrapolation.CLAMP),
    };
  });

  const left = leftAction ? (
    <IconButton action={leftAction} />
  ) : showBack ? (
    <IconButton
      action={{
        icon: 'chevron-back',
        onPress: onBack ?? (() => {}),
        accessibilityLabel: 'Go back',
      }}
    />
  ) : (
    <View style={styles.placeholder} />
  );

  // `trailing` and `rightAction` are additive rather than alternatives: a
  // screen that wants a count *and* a button should not have to give one up,
  // and the icon stays outermost so its position never moves between screens.
  const right =
    trailing || rightAction ? (
      <View style={styles.rightGroup}>
        {trailing}
        {rightAction && <IconButton action={rightAction} />}
      </View>
    ) : (
      <View style={styles.placeholder} />
    );

  // ── Large ───────────────────────────────────────────────────────────
  if (large || hero) {
    // No back arrow, no actions, nothing trailing — then there is no row, and
    // the screen begins with its title instead of with 52px of empty paper.
    const hasActionRow = Boolean(leftAction || showBack || rightAction || trailing);

    // Four combinations, resolved once. The play voice never appears below
    // 30pt — see `typography.ts` for why that floor exists and what breaking it
    // cost the last time.
    const titleVariant = play
      ? hero
        ? 'playHero'
        : 'playTitle'
      : hero
        ? 'displayLight'
        : 'h1';

    return (
      <View style={[styles.largeWrapper, translucent && styles.transparent]}>
        {hasActionRow && (
          <View style={[styles.bar, translucent && styles.transparent]}>
            {left}
            <View style={styles.barSpacer} />
            {right}
          </View>
        )}

        <View style={hasActionRow ? styles.largeHost : styles.largeHostBare}>
          <Animated.View style={[styles.largeBlock, largeBlockStyle]}>
            {eyebrow && (
              <Text
                variant="label"
                color={colors.text.secondary}
                numberOfLines={1}
                style={styles.eyebrow}
              >
                {eyebrow}
              </Text>
            )}

            {/* Bo sits *beside* the title rather than above it, so the header
                stays one block tall. A mascot on her own row pushes the first
                photograph off the fold, which is the wrong trade on the screen
                a parent opens to see photographs. */}
            <View style={styles.titleRow}>
              <View style={styles.titleSlot}>
                <Text
                  variant={titleVariant}
                  numberOfLines={2}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
                {play && (
                  <Doodle
                    kind="underline"
                    size={Math.min(140, title.length * 11)}
                    color={playColors.honey.base}
                    style={styles.titleMark}
                  />
                )}
              </View>

              {mascot && (
                <Bo
                  pose={mascot}
                  size={hero ? 76 : 62}
                  // Facing back into the screen's content rather than off the
                  // right edge.
                  flip
                  style={styles.mascot}
                />
              )}
            </View>

            {subtitle && (
              <Text variant="bodySmall" muted style={styles.subtitle}>
                {subtitle}
              </Text>
            )}
          </Animated.View>

          {/*
            Takes the large title's place rather than a row of its own. Hidden
            from assistive technology because it is the same string as the
            title above it, which stays the one header element on the screen
            whether it happens to be visible or not.
          */}
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.compactOverlay, compactTitleStyle]}
          >
            <Text variant="h4" numberOfLines={1} style={styles.compactTitle}>
              {title}
            </Text>

            {/*
              The mascot survives the collapse.

              The header keeps its full height as the large title fades — see
              the note above about why it must not shrink — so a collapsed
              header used to be one small word floating in a tall empty band,
              with the bee gone. It read as something failing to load rather
              than as a heading that had stepped back.

              She crosses over at a smaller size and stays put, which fills the
              band and keeps the screen recognisable while scrolled. Still
              hidden from assistive technology along with the rest of this
              overlay: it is a second copy of a heading that is already
              announced.
            */}
            {mascot && (
              <Bo pose={mascot} size={38} flip animated={false} />
            )}
          </Animated.View>
        </View>

        <Animated.View style={[styles.rule, ruleStyle]} />
      </View>
    );
  }

  // ── Compact ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.compactWrapper, translucent && styles.transparent]}>
      <View style={[styles.bar, translucent && styles.transparent]}>
        {left}

        <View style={styles.compactTitleSlot}>
          <Text variant="h4" numberOfLines={1} center accessibilityRole="header">
            {title}
          </Text>
          {subtitle && (
            <Text variant="caption" muted numberOfLines={1} center>
              {subtitle}
            </Text>
          )}
        </View>

        {right}
      </View>
      <Animated.View style={[styles.rule, ruleStyle]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  largeWrapper: {
    backgroundColor: colors.background.cream,
  },
  compactWrapper: {
    backgroundColor: colors.background.cream,
  },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.cream,
  },
  barSpacer: {
    flex: 1,
  },
  compactTitleSlot: {
    flex: 1,
    justifyContent: 'center',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** The title block under an action row. */
  largeHost: {
    paddingTop: spacing.xs,
  },
  /** The title block as the top of the screen, with no row above it. */
  largeHostBare: {
    paddingTop: spacing.md,
  },
  largeBlock: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.md,
  },
  /** Lets a `<PlayfulBackdrop>` behind the screen show through the header. */
  transparent: {
    backgroundColor: colors.transparent,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  titleSlot: {
    flex: 1,
    alignItems: 'flex-start',
  },
  /** Pulled up under the baseline so the rule belongs to the word. */
  titleMark: {
    marginTop: -spacing.sm,
    marginLeft: spacing.xs,
  },
  mascot: {
    marginBottom: -spacing.xs,
  },
  compactOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingHorizontal,
  },
  compactTitle: {
    flexShrink: 1,
  },
  eyebrow: {
    marginBottom: spacing.xs + 2,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.default,
  },
  iconButton: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Static rather than animated: a header icon is tapped once and the press is
  // over before a spring would have settled, so the feedback should be the
  // state, not a performance of it.
  iconButtonPressed: {
    opacity: 0.55,
  },
  iconDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error.main,
    borderWidth: 1.5,
    borderColor: colors.background.cream,
  },
  placeholder: {
    width: MIN_TAP_SIZE,
  },
});

export default HeaderBar;
