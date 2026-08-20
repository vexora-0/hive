import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, spacing, radius, layout } from '@/theme';
import { Text } from '@/components/ui';
import { AnimatedCounter, Reveal } from '@/components/animation';
import { ChildSwitcher, type ChildItem } from '@/components/forms';
import { ScreenContainer } from '@/components/layout';
import { EmptyState, OfflineBanner } from '@/components/feedback';
import { PlayfulBackdrop } from '@/components/decor';
import { HeaderBar } from '@/components/navigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

import { useAuthStore } from '@/features/auth/stores/authStore';
import { useChildren } from '@/features/parent/hooks/useChildren';
import { useDiary } from '@/features/parent/hooks/useDiary';
import { usePhotoActions } from '@/features/parent/hooks/usePhotoActions';
import { PhotoActionSheet } from '@/features/parent/components/PhotoActionSheet';
import { DiarySkeleton } from '@/features/parent/components/DiarySkeleton';
import { DiaryStrand } from '@/features/parent/components/DiaryStrand';
import { DiaryChapterCard } from '@/features/parent/components/DiaryChapterCard';
import { ThreadNode, threadStyles } from '@/features/parent/components/DiaryThread';
import type { DiaryOutline } from '@/features/parent/services/diaryService';
import type { FeedPhoto } from '@/features/parent/services/parentService';
import {
  firstName,
  journeyLength,
  longDate,
  monthLabel,
  plural,
} from '@/features/parent/utils/diaryFormat';

// ---------------------------------------------------------------------------
// The diary
// ---------------------------------------------------------------------------
//
// The wall answers "what arrived". This answers "how has it gone" — and they
// are not the same question dressed differently.
//
// A feed is newest-first by construction, so the further back something is, the
// harder it is to reach; a child's first week is the least reachable thing in
// the app, which is exactly backwards for the one artefact a family keeps. The
// diary inverts that. It reads **forwards**, from the first photograph to
// today, along a single thread, with every day stamped and numbered so the
// distance between two pictures is legible as elapsed time rather than as
// scroll position.
//
// Three things make that navigable rather than merely long:
//
//  - **Months are chapters, and chapters are shut.** The whole journey is a
//    screenful of months. Opening one fetches only that month.
//  - **The strand** across the top is both a map of the year and the way to
//    move along it — tick height is that month's photograph count, and tapping
//    a tick opens the month and jumps to it. Today is always one tap away.
//  - **The thread** never breaks. Every row hangs its node on the same line,
//    with a terminus at each end, so the page has a beginning and a now.

/** How far below the top of the viewport a chapter counts as "being read". */
const ACTIVE_BAND = 96;

/** `spacing.sm` of padding plus half a `captionBold` line box. */
const TERMINUS_CENTRE = spacing.sm + 17 / 2;

/** How long a jump is given to settle before the strand tracks scroll again. */
const JUMP_SETTLE_MS = 700;

// ---------------------------------------------------------------------------
// The opening
// ---------------------------------------------------------------------------

/** One figure from the journey, with what it counts underneath. */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View
      style={styles.stat}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      {/* The counter paints into a TextInput so Reanimated can drive it, which
          a screen reader would otherwise announce as an editable field — hence
          the label on the tile and `accessible` here rather than on the digits. */}
      <AnimatedCounter value={value} style={styles.statValue} />
      <Text variant="caption" color={colors.text.tertiary}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The band above the thread: whose diary this is, how long it runs, and the way
 * to the far end of it.
 *
 * The italic line is the screen's **one** editorial voice — the rest of the
 * page is working type — which is why the day entries below print their notes
 * in plain body rather than borrowing it.
 */
function DiaryOpening({
  diary,
  onJumpToToday,
}: {
  diary: DiaryOutline;
  onJumpToToday?: () => void;
}) {
  const { student, summary, chapters } = diary;
  const span = journeyLength(summary.firstPhotoAt, summary.lastPhotoAt);
  const name = firstName(student.fullName) ?? student.fullName;

  return (
    <Reveal style={styles.opening}>
      <Text variant="editorial">
        {student.schoolName
          ? `${name}’s time at ${student.schoolName}, in order.`
          : `${name}’s time at school, in order.`}
      </Text>

      {summary.firstPhotoAt && (
        <Text variant="caption" color={colors.text.tertiary} style={styles.openingMeta}>
          {span
            ? `Since ${longDate(summary.firstPhotoAt)} · ${plural(span, 'day')}`
            : `Since ${longDate(summary.firstPhotoAt)}`}
        </Text>
      )}

      <View style={styles.stats}>
        <Stat value={summary.totalPhotos} label="photos" />
        <Stat value={summary.totalDays} label="days captured" />
        <Stat value={chapters.length} label={chapters.length === 1 ? 'month' : 'months'} />
      </View>

      {/* Reading a diary forwards is right for a journey and wrong for a parent
          who opened the app to see this afternoon. This is the way back to now
          that does not cost a scroll — the strand's last tick does the same
          thing, and this says so in words. */}
      {onJumpToToday && (
        <Pressable
          onPress={onJumpToToday}
          style={({ pressed }) => [styles.jump, pressed && styles.jumpPressed]}
          accessibilityRole="button"
          accessibilityLabel="Jump to the most recent month"
        >
          <Text variant="captionBold" color={colors.text.accent}>
            Jump to today
          </Text>
          <Ionicons name="arrow-down" size={13} color={colors.text.accent} />
        </Pressable>
      )}
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// The ends of the thread
// ---------------------------------------------------------------------------

/**
 * A terminal on the thread — an open ring rather than a filled node, because it
 * marks where the line stops rather than a month you can open.
 */
function Terminus({
  title,
  detail,
  cap,
}: {
  title: string;
  detail?: string;
  cap: 'top' | 'bottom';
}) {
  return (
    <View style={styles.terminus}>
      <ThreadNode
        kind="terminus"
        centre={TERMINUS_CENTRE}
        capTop={cap === 'top'}
        capBottom={cap === 'bottom'}
      />
      <View style={threadStyles.row}>
        <Text variant="captionBold" color={colors.text.secondary}>
          {title}
        </Text>
        {detail && (
          <Text variant="caption" color={colors.text.tertiary}>
            {detail}
          </Text>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Parent diary — the child's journey, read forwards.
 *
 * The parent's home. Four states, as every list owes: a skeleton shaped like
 * the thread, an error that offers a retry rather than pretending the child had
 * no year, two kinds of empty, and the journey.
 */
export default function DiaryScreen() {
  const { isOffline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const userEmail = useAuthStore((s) => s.user?.email) ?? 'your email address';

  const {
    children,
    isLoading: isLoadingChildren,
    selectedChild,
    setSelectedChild,
  } = useChildren();

  /**
   * A diary belongs to **one** child, so there is no "All" here.
   *
   * The wall offers a merged view because "what arrived today" is a question
   * about a household. A journey is not: two children's photographs interleaved
   * into one timeline would be a story of neither, and "Day 40" would be a
   * claim about whichever of them started first.
   */
  const studentId = selectedChild?.id;

  const { diary, isLoading, isError, refetch, isRefetching } = useDiary(studentId);

  const { selectedPhoto, setSelectedPhoto, clearSelectedPhoto, handleAction } =
    usePhotoActions();

  // ---- Which months are open --------------------------------------------
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [activeMonth, setActiveMonth] = useState<string | null>(null);

  const chapters = useMemo(() => diary?.chapters ?? [], [diary?.chapters]);

  /**
   * The diary opens on the beginning, with the first month already unfolded.
   *
   * Which is the whole point of the screen — a parent arriving at their child's
   * first week without scrolling for it — and is why "Jump to today" exists in
   * the band above rather than being the default.
   *
   * Keyed on the child and their first month, so switching siblings resets the
   * page rather than carrying one child's open months onto another's timeline.
   */
  const firstMonth = chapters[0]?.month;
  useEffect(() => {
    setOpenMonths(firstMonth ? new Set([firstMonth]) : new Set());
    setActiveMonth(firstMonth ?? null);
  }, [studentId, firstMonth]);

  // ---- Scrolling ---------------------------------------------------------
  const scrollRef = useRef<ScrollView>(null);
  /**
   * Measured **heights** — of the block above the thread, and of each chapter.
   *
   * Nothing here records a `y`, and that is the whole point. A view's measured
   * position is only true at the instant it was measured: opening a month
   * pushes every month below it down the page, and on web `onLayout` is backed
   * by a `ResizeObserver`, which reports size changes and not position changes
   * — so the moved chapter is never told it moved and a stored `y` silently
   * rots. (Native *does* report the move, which is exactly the kind of
   * difference that ships: it worked on a phone and pointed at the wrong month
   * in a browser.)
   *
   * Heights are what the observer actually watches, so `offsetOf` adds them up
   * instead. Every position on this screen is derived, never remembered.
   */
  const headHeight = useRef(0);
  const heights = useRef(new Map<string, number>());
  /** A jump waiting on the target chapter to finish laying itself out. */
  const pendingJump = useRef<string | null>(null);
  /**
   * While a programmatic jump is animating, the scroll handler must not keep
   * re-deriving the active month from the scroll position.
   *
   * Without this a tap on the far end of the strand drags the highlight through
   * every month in between — and the strand, which scrolls itself to keep the
   * active tick centred, races off after it. A deadline rather than a listener
   * because `scrollTo({ animated: true })` does not reliably emit
   * `onMomentumScrollEnd` on every platform, and a guard that never clears is
   * worse than one that clears too early.
   */
  const jumpingUntil = useRef(0);
  /** Mirrors `activeMonth` for the scroll handler, which must not re-bind. */
  const activeRef = useRef<string | null>(null);
  const chaptersRef = useRef(chapters);

  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  useEffect(() => {
    activeRef.current = activeMonth;
  }, [activeMonth]);

  /**
   * The collapsing header's scroll position, written from a plain JS handler.
   *
   * Same reasoning as the wall: `useAnimatedScrollHandler` returns an object
   * rather than a function, and this screen also has to do real work per frame
   * — deciding which month is being read — which is JS work regardless.
   */
  const scrollY = useSharedValue(0);

  /**
   * Where a chapter starts in the scroll content, right now.
   *
   * The opening band and the first terminus, then the chapters before this one.
   * Returns null until the run has been measured, so a caller aims at nothing
   * rather than at zero.
   */
  const offsetOf = useCallback((month: string): number | null => {
    let acc = headHeight.current;
    if (!acc) return null;

    for (const chapter of chaptersRef.current) {
      if (chapter.month === month) return acc;
      const height = heights.current.get(chapter.month);
      if (height == null) return null;
      acc += height;
    }
    return null;
  }, []);

  /** The block above the thread's first chapter — remeasured whenever it grows. */
  const handleHeadLayout = useCallback((event: LayoutChangeEvent) => {
    headHeight.current = event.nativeEvent.layout.height;
  }, []);

  const scrollToMonth = useCallback(
    (month: string) => {
      const y = offsetOf(month);
      if (y == null) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.sm), animated: true });
    },
    [offsetOf],
  );

  const handleChapterLayout = useCallback(
    (month: string, event: LayoutChangeEvent) => {
      heights.current.set(month, event.nativeEvent.layout.height);

      // A chapter that was just asked for grows when its days arrive, which
      // moves everything under it. Re-aiming on its own layout is what makes a
      // jump land on the month rather than near it.
      if (pendingJump.current === month) {
        pendingJump.current = null;
        jumpingUntil.current = Date.now() + JUMP_SETTLE_MS;
        scrollToMonth(month);
      }
    },
    [scrollToMonth],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollY.value = y;

      // The header still collapses during a jump; only the strand's highlight
      // is held, because that is the part a jump would make flicker.
      if (Date.now() < jumpingUntil.current) return;

      // The strand is a position indicator as well as a control, so it has to
      // follow the scroll and not only the taps. The last chapter whose top has
      // passed the band is the one being read.
      let current: string | null = null;
      for (const chapter of chaptersRef.current) {
        const offset = offsetOf(chapter.month);
        if (offset != null && offset <= y + ACTIVE_BAND) current = chapter.month;
      }

      if (current && current !== activeRef.current) {
        activeRef.current = current;
        setActiveMonth(current);
      }
    },
    [scrollY, offsetOf],
  );

  const handleSelectMonth = useCallback(
    (month: string) => {
      setActiveMonth(month);
      activeRef.current = month;
      setOpenMonths((prev) => (prev.has(month) ? prev : new Set(prev).add(month)));
      pendingJump.current = month;
      jumpingUntil.current = Date.now() + JUMP_SETTLE_MS;
      // Lands immediately when the chapter was already open and laid out;
      // otherwise `handleChapterLayout` re-aims once it has grown.
      scrollToMonth(month);
    },
    [scrollToMonth],
  );

  const handleToggleMonth = useCallback((month: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
    setActiveMonth(month);
  }, []);

  const handleJumpToToday = useCallback(() => {
    const last = chapters[chapters.length - 1]?.month;
    if (last) handleSelectMonth(last);
  }, [chapters, handleSelectMonth]);

  // ---- The child switcher ------------------------------------------------
  const childItems: ChildItem[] = useMemo(
    () =>
      children.map((c) => ({
        id: c.id,
        name: c.fullName,
        avatarUrl: c.avatarUrl,
      })),
    [children],
  );

  const handleChildSelect = useCallback(
    (item: ChildItem) => {
      const child = children.find((c) => c.id === item.id);
      if (child) setSelectedChild(child);
    },
    [children, setSelectedChild],
  );

  // ---- Photo interactions ------------------------------------------------
  const handlePhotoPress = useCallback(
    (photo: FeedPhoto) => {
      handleAction('viewFullScreen', photo);
    },
    [handleAction],
  );

  const handlePhotoLongPress = useCallback(
    async (photo: FeedPhoto) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedPhoto(photo);
    },
    [setSelectedPhoto],
  );

  // ---- Refresh -----------------------------------------------------------
  //
  // The outline and every open chapter, not just the outline: refreshing a
  // timeline that then shows a month's photographs from ten minutes ago is the
  // kind of half-refresh that teaches people the gesture does not work.
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['diary-chapter', studentId] });
    refetch();
  }, [queryClient, studentId, refetch]);

  // ---- Header text -------------------------------------------------------
  const eyebrow = selectedChild
    ? [firstName(selectedChild.fullName), selectedChild.className]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  /**
   * The chrome above the thread.
   *
   * Wrapped in a plain `<View>`, and that is load-bearing rather than tidiness.
   * `<ChildSwitcher>` is a horizontal `FlatList`, and React Native's ScrollView
   * base style is `flexGrow: 1, flexShrink: 1` — so as a direct child of this
   * screen's column, sandwiched between the strand and a `flex: 1` scroll view,
   * it was squeezed below its content height and clipped its own pills' rounded
   * bottoms off. A `<View>` does not shrink, so the list lays out at the height
   * its rows actually need. The wall does the same thing for the same reason,
   * one level down inside its list header.
   */
  const chrome = (
    <View style={styles.chrome}>
      <OfflineBanner visible={isOffline} />
      {children.length > 1 && (
        <ChildSwitcher
          children={childItems}
          selectedId={selectedChild?.id}
          onSelect={handleChildSelect}
          allowAll={false}
        />
      )}
    </View>
  );

  // ---- Loading -----------------------------------------------------------
  //
  // The switcher stays above the skeleton rather than being swapped out with
  // it: tapping a sibling changes the query key, which is an uncached fetch,
  // and the control the parent just touched must not disappear under their
  // finger.
  //
  // `children.length > 0 && !studentId` is the frame between the roster landing
  // and `useChildren`'s effect picking a child. Without it the screen paints
  // "The diary starts soon." for one frame on every cold open — telling a
  // parent their child has no photographs, a moment before showing them.
  if (
    isLoadingChildren ||
    (children.length > 0 && !studentId) ||
    (isLoading && !!studentId)
  ) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <PlayfulBackdrop level="quiet" />
        <HeaderBar hero play translucent mascot="idle" title="Diary" eyebrow={eyebrow} />
        {chrome}
        <DiarySkeleton />
      </ScreenContainer>
    );
  }

  // ---- Nothing to show ---------------------------------------------------
  const hasJourney = !!diary && diary.chapters.length > 0;

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* `quiet` — the same wash the wall uses. Every layer behind a page made
          of photographs is a layer competing with them. */}
      <PlayfulBackdrop level="quiet" />

      <HeaderBar
        hero
        play
        translucent
        mascot="idle"
        title="Diary"
        eyebrow={eyebrow}
        scrollY={scrollY}
      />

      {chrome}

      {/* Pinned above the scroll rather than inside it. The strand is this
          screen's instrument — a map you can only use while you are somewhere
          on it — so scrolling it away would take away the one control that
          makes a long journey navigable. */}
      {hasJourney && (
        <DiaryStrand
          chapters={diary.chapters}
          activeMonth={activeMonth}
          onSelect={handleSelectMonth}
        />
      )}

      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            // `primary.amber` is 2.03:1 and a spinner drawn in it disappears
            // against paper; this is its readable form.
            tintColor={colors.primary.amberDark}
            colors={[colors.primary.amberDark]}
            progressBackgroundColor={colors.background.surface}
          />
        }
      >
        {isError ? (
          <View style={styles.emptyHost}>
            <EmptyState
              variant="error"
              title="Couldn't load the diary."
              message="It may just be the connection. Try again in a moment."
              action={{ label: 'Try again', onPress: () => refetch() }}
            />
          </View>
        ) : children.length === 0 ? (
          <View style={styles.emptyHost}>
            <EmptyState
              variant="first-use"
              illustration="school"
              title="No children linked yet."
              message={
                'Your school links your child to your account. Ask them to check this address:\n\n' +
                userEmail
              }
            />
          </View>
        ) : !hasJourney ? (
          <View style={styles.emptyHost}>
            <EmptyState
              variant="first-use"
              illustration="album"
              title="The diary starts soon."
              message={`When ${
                firstName(selectedChild?.fullName) ?? 'your child'
              }'s teacher shares a first moment, it will open here.`}
            />
          </View>
        ) : (
          <>
            {/* Measured as one block. Everything the thread positions itself
                against is a height, never a remembered y — see `offsetOf`. */}
            <View onLayout={handleHeadLayout}>
              <DiaryOpening
                diary={diary}
                onJumpToToday={chapters.length > 1 ? handleJumpToToday : undefined}
              />

              {diary.summary.firstPhotoAt && (
                <Terminus
                  cap="top"
                  title="Where it begins"
                  detail={longDate(diary.summary.firstPhotoAt)}
                />
              )}
            </View>

            {chapters.map((chapter) => (
              <View
                key={chapter.month}
                onLayout={(event) => handleChapterLayout(chapter.month, event)}
              >
                <DiaryChapterCard
                  chapter={chapter}
                  studentId={studentId!}
                  journeyStart={diary.summary.firstPhotoAt}
                  isOpen={openMonths.has(chapter.month)}
                  onToggle={handleToggleMonth}
                  onPhotoPress={handlePhotoPress}
                  onPhotoLongPress={handlePhotoLongPress}
                />
              </View>
            ))}

            <Terminus
              cap="bottom"
              title="Up to today"
              detail={
                diary.summary.lastPhotoAt
                  ? `Latest: ${monthLabel(chapters[chapters.length - 1].month)}`
                  : undefined
              }
            />

            {/* The outline scans a bounded number of photographs. Saying so
                where it bites is the difference between a journey that started
                in March and one we could only read back to March. */}
            {diary.summary.truncated && (
              <View style={styles.truncated}>
                <Text variant="caption" color={colors.text.tertiary} center>
                  This diary is long enough that only the most recent part is
                  shown.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <PhotoActionSheet
        photo={selectedPhoto}
        isVisible={selectedPhoto !== null}
        onClose={clearSelectedPhoto}
        onAction={handleAction}
      />
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    paddingBottom: layout.tabBarClearance,
  },

  /** See the note at the call site — this must not shrink. */
  chrome: {
    flexShrink: 0,
  },

  // ── The opening band ──
  opening: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  openingMeta: {
    marginTop: spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  stat: {
    minWidth: 54,
  },
  statValue: {
    // The counter carries its own display face and size; only the leading is
    // set here, so the three figures sit on one line with their labels.
    marginBottom: spacing.xxs,
  },
  jump: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.ms,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.amberWash,
  },
  jumpPressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },

  // ── The ends of the thread ──
  terminus: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },

  truncated: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  /**
   * A floor under the empty states. `EmptyState` asks for `flex: 1`, and inside
   * scroll content sized by what is in it that resolves to a height of nothing
   * — the state is then perfectly correct and perfectly invisible.
   */
  emptyHost: {
    minHeight: 420,
  },
});
