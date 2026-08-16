import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, spacing, radius, layout, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui';
import { PhotoMount } from '@/components/media';
import { Reveal } from '@/components/animation';
import { ChildSwitcher, type ChildItem } from '@/components/forms';
import { ScreenContainer } from '@/components/layout';
import { EmptyState, OfflineBanner } from '@/components/feedback';
import { PlayfulBackdrop } from '@/components/decor';
import { BoLoader } from '@/components/mascot';
import { HeaderBar } from '@/components/navigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

import { useAuthStore } from '@/features/auth/stores/authStore';
import { useChildren } from '@/features/parent/hooks/useChildren';
import { useFeed } from '@/features/parent/hooks/useFeed';
import { usePhotoActions } from '@/features/parent/hooks/usePhotoActions';
import { FeedSkeleton } from '@/features/parent/components/FeedSkeleton';
import { PhotoActionSheet } from '@/features/parent/components/PhotoActionSheet';
import type { FeedPhoto } from '@/features/parent/services/parentService';

// ---------------------------------------------------------------------------
// The rows a day becomes
// ---------------------------------------------------------------------------

/**
 * The feed is not a grid of photographs; it is a run of days, and each day is a
 * few rows of print.
 *
 * At a preschool **the date is the event**. Nothing else about a Tuesday needs
 * naming — no activity type, no album, no "Sharing a pic and note" title — so
 * the day header carries the whole context and every row beneath it is simply
 * a photograph. That is also why Hive needs no event-grouping feature: the
 * grouping already exists, and it is free.
 *
 * Three row kinds, packed by hand rather than left to a masonry engine. Hand
 * packing is what buys the header (a masonry list cannot interleave one) and
 * what guarantees chronology: FlashList's own `optimizeItemArrangement` levels
 * the columns by *reordering the photographs*, which in a keepsake album reads
 * as the story happening out of order.
 */
type FeedRow =
  | {
      kind: 'day';
      key: string;
      /** "Today", "Yesterday", "Tuesday, 12 Aug". */
      title: string;
      /** "9 photos · Priya Nair" — whatever the data can honestly support. */
      meta: string;
    }
  | { kind: 'hero'; key: string; photo: FeedPhoto; attribution?: string }
  | {
      kind: 'pair';
      key: string;
      left: FeedPhoto;
      right: FeedPhoto;
      attribution: boolean;
    }
  /**
   * A large print beside a smaller one, resting on a common baseline.
   *
   * `mirrored` puts the large print on the right, so two duos in one day are
   * not the same picture twice.
   *
   * **This replaced a triptych** — one tall print beside two stacked squares —
   * which could not be made to work. The two halves have to finish level or
   * the spread reads as a mistake, and their heights are driven by different
   * things: the tall print by one image and one caption, the column by two
   * images, two captions and a gap. A fixed aspect ratio can only balance that
   * for one caption configuration, and captions here are conditional — they
   * appear only when a day had more than one teacher. Measured, the two halves
   * finished 130px apart. Two single prints on a shared baseline cannot
   * disagree about anything.
   */
  | {
      kind: 'duo';
      key: string;
      big: FeedPhoto;
      small: FeedPhoto;
      mirrored: boolean;
      attribution: boolean;
    }
  /** Three small prints in a row, pinned slightly askew. */
  | {
      kind: 'trio';
      key: string;
      photos: [FeedPhoto, FeedPhoto, FeedPhoto];
      attribution: boolean;
    };

interface FeedLayout {
  rows: FeedRow[];
  /** Indices into `rows` — plain data indices, unaffected by the list header. */
  stickyIndices: number[];
  /** How many photographs arrived today, or 0 when the newest day is older. */
  todayCount: number;
  /** True once there is a day behind today's — the strip needs a boundary. */
  hasOlderDays: boolean;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Bucket key for a photograph's day, in the **device's** timezone.
 *
 * `toDateString()` rather than slicing the ISO string: the API sends UTC, and a
 * photo taken at half eleven at night in Bengaluru is already the next day in
 * UTC. Slicing would file a Tuesday evening under Wednesday.
 */
function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** Relative where a parent thinks relatively, absolute after that. Never raw. */
function dayTitle(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** First name only — a header line has no room for the family name. */
function firstName(name?: string | null): string | undefined {
  if (!name) return undefined;
  return name.trim().split(/\s+/)[0];
}

/**
 * Who was behind the camera that day.
 *
 * One teacher is named. Two or more are counted, because a header that lists
 * three names stops being scannable and the second name is not the thing the
 * parent came for. Nobody named at all — a deleted account — and the clause is
 * simply left out rather than printed as "by someone".
 */
function teacherLabel(names: string[]): string | undefined {
  if (names.length === 0) return undefined;
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

// ---------------------------------------------------------------------------
// Packing
// ---------------------------------------------------------------------------

/**
 * Turns a flat, newest-first run of photographs into day-headed rows.
 *
 * Each day opens with **one photograph at full width**, then pairs. A single
 * print occupying most of the viewport is the difference between an album and a
 * contact sheet, and it costs nothing: the pairs behind it still fit four
 * photographs on a screen. A day with an odd tail ends on another full-width
 * print rather than a lone half-width one hanging in a column.
 *
 * Attribution is printed on a mount **only when a day had more than one
 * teacher**. Otherwise the day header already said who took them, and repeating
 * "by Priya" nine times is the noise the mount's caption band exists to avoid.
 */
/**
 * The spread cycle.
 *
 * Four entries, and the even pair sits between the two asymmetric duos on
 * purpose: two lopsided spreads back to back both lean the same way and read
 * as a drift. The mirrored duo closes the loop, so the pattern takes nine
 * photographs to repeat — more than most days hold, which is the point.
 */
const SPREADS = ['duo', 'pair', 'trio', 'duoR'] as const;

/**
 * How much wider the big print is than the small one in a duo.
 *
 * 1.7 is enough that the two read as *deliberately* different sizes rather than
 * as a pair that failed to line up — below about 1.4 the asymmetry looks like a
 * rounding error.
 */
const DUO_BIG_FLEX = 1.7;

/** A degree and a half, alternating. See the note at the call site. */
const TRIO_TILT = ['-1.5deg', '1deg', '-0.8deg'] as const;

function buildFeedLayout(photos: FeedPhoto[]): FeedLayout {
  const rows: FeedRow[] = [];
  const stickyIndices: number[] = [];
  /** Advances across days, so two days running never open the same way. */
  let spreadCursor = 0;

  const groups = new Map<string, FeedPhoto[]>();
  for (const photo of photos) {
    const key = dayKey(photo.createdAt);
    const bucket = groups.get(key);
    if (bucket) bucket.push(photo);
    else groups.set(key, [photo]);
  }

  let todayCount = 0;
  const todayKey = new Date().toDateString();

  for (const [key, dayPhotos] of groups) {
    const names = Array.from(
      new Set(
        dayPhotos
          .map((p) => firstName(p.uploadedBy.name))
          .filter((n): n is string => Boolean(n)),
      ),
    );
    const multipleTeachers = names.length > 1;

    const count = `${dayPhotos.length} ${dayPhotos.length === 1 ? 'photo' : 'photos'}`;
    const teacher = teacherLabel(names);

    stickyIndices.push(rows.length);
    rows.push({
      kind: 'day',
      key: `day-${key}`,
      title: dayTitle(dayPhotos[0].createdAt),
      meta: teacher ? `${count} · ${teacher}` : count,
    });

    if (key === todayKey) todayCount = dayPhotos.length;

    const attribution = (photo: FeedPhoto) =>
      multipleTeachers && photo.uploadedBy.name
        ? `by ${photo.uploadedBy.name}`
        : undefined;

    // The day's opening print, full width.
    rows.push({
      kind: 'hero',
      key: dayPhotos[0].id,
      photo: dayPhotos[0],
      attribution: attribution(dayPhotos[0]),
    });

    // ── Then the spreads ────────────────────────────────────────────
    //
    // The wall used to be `hero` followed by pairs, forever. Every day in the
    // feed therefore had exactly the same shape — one big print and then a
    // column of twos — and a parent scrolling a fortnight of school saw the
    // same page fourteen times. The photographs changed; the page did not.
    //
    // So the remainder of each day is laid out by **cycling a small set of
    // spreads**, the way a photo book does: a triptych, a pair, a trio of
    // small prints, a triptych flipped the other way. The cursor advances per
    // spread rather than per photo, so the rhythm carries across a day rather
    // than resetting, and two adjacent days do not land on the same template.
    //
    // Every branch consumes exactly what it claims and the loop always
    // terminates on the tail cases — a template that cannot be filled is never
    // chosen, so the wall can never end on a hole.
    let i = 1;
    let spread = spreadCursor;

    while (i < dayPhotos.length) {
      const left = dayPhotos.length - i;

      // Tails first. Three or fewer photographs left is not enough to choose
      // between templates, so it is laid out the only way it fits.
      if (left === 1) {
        rows.push({
          kind: 'hero',
          key: dayPhotos[i].id,
          photo: dayPhotos[i],
          attribution: attribution(dayPhotos[i]),
        });
        i += 1;
        continue;
      }

      if (left === 2) {
        rows.push({
          kind: 'pair',
          key: `${dayPhotos[i].id}-${dayPhotos[i + 1].id}`,
          left: dayPhotos[i],
          right: dayPhotos[i + 1],
          attribution: multipleTeachers,
        });
        i += 2;
        continue;
      }

      const template = SPREADS[spread % SPREADS.length];
      spread += 1;

      if (template === 'trio') {
        rows.push({
          kind: 'trio',
          key: `trio-${dayPhotos[i].id}`,
          photos: [dayPhotos[i], dayPhotos[i + 1], dayPhotos[i + 2]],
          attribution: multipleTeachers,
        });
        i += 3;
      } else if (template === 'pair') {
        rows.push({
          kind: 'pair',
          key: `${dayPhotos[i].id}-${dayPhotos[i + 1].id}`,
          left: dayPhotos[i],
          right: dayPhotos[i + 1],
          attribution: multipleTeachers,
        });
        i += 2;
      } else {
        rows.push({
          kind: 'duo',
          key: `duo-${dayPhotos[i].id}`,
          big: dayPhotos[i],
          small: dayPhotos[i + 1],
          mirrored: template === 'duoR',
          attribution: multipleTeachers,
        });
        i += 2;
      }
    }

    // Carried into the next day, so consecutive days open on different spreads.
    spreadCursor = spread;
  }

  return {
    rows,
    stickyIndices,
    todayCount,
    hasOlderDays: groups.size > 1,
  };
}

// ---------------------------------------------------------------------------
// The day header
// ---------------------------------------------------------------------------

/**
 * The one piece of chrome inside the wall, and it does real work: which day,
 * how many, and whose class the photographs came from.
 *
 * It is opaque paper rather than a tint, because it is sticky and a photograph
 * scrolling underneath a translucent bar is unreadable. No `<Reveal>` here on
 * purpose — FlashList renders the *stuck* copy through `renderItem` as a fresh
 * instance, so an entrance animation would replay every time a day pins itself
 * to the top.
 */
function DayHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <View style={styles.dayHeader}>
      <Text variant="h4" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="caption" color={colors.text.tertiary} style={styles.dayMeta}>
        {meta}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The arrivals strip
// ---------------------------------------------------------------------------

/**
 * "9 photos arrived today." — quiet, factual, and gone the moment it is
 * dismissed.
 *
 * It says only what the feed can prove. Hive stores no `last_feed_seen_at`, so
 * "new since you last looked" would be a claim about the parent rather than
 * about the data; the count of photographs that arrived today is a fact, and it
 * is the fact a parent opening the app at six in the evening wants first.
 *
 * Marigold appears here as a **surface**. The words are ink — `#F0A03A` is
 * 2.03:1 on paper and cannot carry a syllable.
 */
function ArrivalsStrip({
  count,
  onDismiss,
}: {
  count: number;
  onDismiss: () => void;
}) {
  return (
    <Reveal style={styles.strip}>
      <View style={styles.stripBody}>
        <Text variant="bodySmallBold" style={styles.stripText}>
          {count === 1 ? '1 photo arrived today.' : `${count} photos arrived today.`}
        </Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          style={styles.stripDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={17} color={colors.text.secondary} />
        </Pressable>
      </View>
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Parent feed — the album, and the reason the product exists.
 *
 * The chrome withdraws entirely here: paper header, no fill, no logo, no
 * launcher grid. What is left is a run of days, each opening on one large
 * photograph. The photograph **is** the row — there is no event-type chip, no
 * camera glyph and no system-written title above it, which is the one position
 * none of the competitors occupy.
 *
 * Four states, as every list owes: a delayed skeleton shaped like the wall, an
 * error that offers a retry rather than dressing itself up as an empty album,
 * two different kinds of empty, and the photographs.
 */
export default function FeedScreen() {
  const { isOffline } = useNetworkStatus();
  const userEmail = useAuthStore((s) => s.user?.email) ?? 'your email address';
  const {
    children,
    isLoading: isLoadingChildren,
    selectedChild,
    setSelectedChild,
  } = useChildren();

  /**
   * Whose photographs the wall is showing.
   *
   * **All is the starting position.** With one child the combined feed *is*
   * that child's feed, so it is right for every family, and it spares a
   * single-child parent the refetch that used to fire the moment the roster
   * landed and auto-selected somebody. Held here rather than pushed into
   * `useChildren` because the merged view is a presentation choice: the hook
   * still tracks a selected child, this screen simply looks past it.
   */
  const [showAll, setShowAll] = useState(true);
  const activeChildId = showAll ? undefined : selectedChild?.id;

  const {
    photos,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingFeed,
    isError: isFeedError,
    refetch,
    isRefetching,
  } = useFeed(activeChildId);

  const { selectedPhoto, setSelectedPhoto, clearSelectedPhoto, handleAction } =
    usePhotoActions();

  /**
   * The collapsing header's scroll position.
   *
   * Written from a **plain JavaScript handler** rather than through
   * `useHeaderScroll()`, and that is not a stylistic choice. FlashList v2
   * attaches its own `Animated.event` to the scroll view and invokes the
   * caller's handler by hand — `props.onScroll?.call(props, event)` — while
   * Reanimated's `useAnimatedScrollHandler` returns an *object*
   * (`{ workletEventHandler }`), not a function. Handing one to FlashList
   * therefore throws `onScroll.call is not a function` on the first scroll
   * event, which on this screen means the app dies the moment a parent flicks
   * their child's feed.
   *
   * Writing the offset into a shared value from JS costs one bridge hop per
   * frame at `scrollEventThrottle={16}`; the interpolation the header actually
   * does with it still runs on the UI thread.
   */
  const scrollY = useSharedValue(0);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const [stripDismissed, setStripDismissed] = useState(false);

  // ---- The wall ----------------------------------------------------------
  // `stickyIndices` is deliberately not taken — see the note on <FlashList>
  // below. `buildFeedLayout` still computes it and it is still correct.
  const { rows, todayCount, hasOlderDays } = useMemo(
    () => buildFeedLayout(photos),
    [photos],
  );

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
      if (child) {
        setShowAll(false);
        setSelectedChild(child);
      }
    },
    [children, setSelectedChild],
  );

  const handleSelectAll = useCallback(() => setShowAll(true), []);

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

  // ---- Infinite scroll ---------------------------------------------------
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ---- Rows --------------------------------------------------------------
  const renderRow: ListRenderItem<FeedRow> = useCallback(
    ({ item, index }) => {
      if (item.kind === 'day') {
        return <DayHeader title={item.title} meta={item.meta} />;
      }

      // Only the first screenful is choreographed, and `Reveal` plays once per
      // instance — a recycled cell arriving mid-scroll is simply there, which
      // is what a list already in motion should look like.
      const staggerIndex = index < 6 ? index : 0;

      if (item.kind === 'hero') {
        return (
          <Reveal index={staggerIndex} style={styles.heroRow}>
            <PhotoMount
              id={item.photo.id}
              uri={item.photo.thumbnailUri ?? item.photo.uri}
              blurhash={item.photo.blurhash ?? undefined}
              width={item.photo.width}
              height={item.photo.height}
              caption={item.attribution}
              onPress={() => handlePhotoPress(item.photo)}
              onLongPress={() => handlePhotoLongPress(item.photo)}
            />
          </Reveal>
        );
      }

      // One print, wired up. Every template below is built from this, so the
      // caption rule, the press handlers and the thumbnail fallback are
      // written once rather than four times.
      const print = (
        photo: FeedPhoto,
        attributed: boolean,
        aspectRatio?: number,
      ) => (
        <PhotoMount
          id={photo.id}
          uri={photo.thumbnailUri ?? photo.uri}
          blurhash={photo.blurhash ?? undefined}
          width={aspectRatio ? undefined : photo.width}
          height={aspectRatio ? undefined : photo.height}
          aspectRatio={aspectRatio}
          caption={
            attributed && photo.uploadedBy.name
              ? `by ${photo.uploadedBy.name}`
              : undefined
          }
          onPress={() => handlePhotoPress(photo)}
          onLongPress={() => handlePhotoLongPress(photo)}
        />
      );

      if (item.kind === 'duo') {
        // Both prints keep their own shape and rest on a shared baseline —
        // `duoRow` aligns to `flex-end`, so however tall each one turns out,
        // they finish on the same line like prints standing on a shelf. That
        // is the whole reason this template replaced the triptych.
        return (
          <Reveal
            index={staggerIndex}
            style={[styles.duoRow, item.mirrored && styles.rowMirrored]}
          >
            <View style={styles.duoBig}>{print(item.big, item.attribution)}</View>
            <View style={styles.duoSmall}>
              {print(item.small, item.attribution)}
            </View>
          </Reveal>
        );
      }

      if (item.kind === 'trio') {
        return (
          <Reveal index={staggerIndex} style={styles.trioRow}>
            {item.photos.map((photo, cell) => (
              <View
                key={photo.id}
                style={[
                  styles.trioCell,
                  // A hand pinned these, not a grid. The tilt is tiny — a
                  // degree and a half — and alternates by position so it never
                  // looks like a drift in one direction. Square prints, so a
                  // rotated corner cannot collide with its neighbour's caption.
                  { transform: [{ rotate: TRIO_TILT[cell] }] },
                ]}
              >
                {print(photo, false, 1)}
              </View>
            ))}
          </Reveal>
        );
      }

      return (
        <Reveal index={staggerIndex} style={styles.pairRow}>
          {[item.left, item.right].map((photo) => (
            <View key={photo.id} style={styles.pairCell}>
              {print(photo, item.attribution)}
            </View>
          ))}
        </Reveal>
      );
    },
    [handlePhotoPress, handlePhotoLongPress],
  );

  // Headers must never recycle into photo cells, and a full-width print must
  // never be measured against a half-width one.
  const rowType = useCallback((row: FeedRow) => row.kind, []);
  const rowKey = useCallback((row: FeedRow) => row.key, []);

  // ---- List header -------------------------------------------------------
  const showStrip = !stripDismissed && todayCount > 0 && hasOlderDays;

  const ListHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <OfflineBanner visible={isOffline} />
        <ChildSwitcher
          children={childItems}
          selectedId={showAll ? null : selectedChild?.id}
          onSelect={handleChildSelect}
          onSelectAll={handleSelectAll}
        />
        {showStrip && (
          <ArrivalsStrip
            count={todayCount}
            onDismiss={() => setStripDismissed(true)}
          />
        )}
      </View>
    ),
    [
      childItems,
      selectedChild?.id,
      showAll,
      handleChildSelect,
      handleSelectAll,
      isOffline,
      showStrip,
      todayCount,
    ],
  );

  // ---- List footer -------------------------------------------------------
  const ListFooter = useMemo(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footer}>
          {/* Bo flying a lap of a comb cell, in the slot a spinner used to
              hold. It is a swap rather than an addition — this screen already
              paid for a loading indicator here — and it is the one place in
              the app where waiting is *for photographs of your child*, which
              is a thing worth saying with the product's own character rather
              than with a system arc. */}
          <BoLoader size={84} label="Fetching more moments" />
        </View>
      );
    }
    // Tells a parent they have reached the end rather than leaving them
    // pulling at a list that has quietly stopped.
    if (photos.length > 0 && !hasNextPage) {
      return (
        <View style={styles.footer}>
          <Text variant="caption" color={colors.text.tertiary} center>
            That&apos;s everything so far
          </Text>
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage, hasNextPage, photos.length]);

  // ---- Header text -------------------------------------------------------
  //
  // Under All with siblings the eyebrow names them, because "Moments" over a
  // merged feed otherwise says nothing about whose. With one child there is
  // nothing to merge, so it stays the child and their class either way.
  const single = children.length === 1 ? children[0] : undefined;
  const named = showAll && !single ? undefined : (single ?? selectedChild);
  const eyebrow = named
    ? [firstName(named.fullName), named.className].filter(Boolean).join(' · ')
    : children.length > 1
      ? children
          .map((c) => firstName(c.fullName))
          .filter(Boolean)
          .join(' · ')
      : undefined;

  // ---- Loading -----------------------------------------------------------
  //
  // The switcher is drawn above the skeleton, not swapped out with it. Tapping
  // a sibling's chip changes the query key, which is an uncached fetch, which
  // is `isLoadingFeed` — so without this the control the parent just touched
  // disappears under their finger and comes back a moment later.
  if (isLoadingChildren || isLoadingFeed) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <PlayfulBackdrop level="quiet" />
        <HeaderBar hero play translucent mascot="idle" title="Moments" eyebrow={eyebrow} />
        <View style={styles.loadingHeader}>{ListHeader}</View>
        <FeedSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* `quiet` — light only, no comb and no pollen.
          This is the one screen in the app that is *made of* photographs, and
          every layer behind them is a layer competing with them. The wash alone
          is enough to stop the page reading as a blank sheet; anything more and
          the backdrop starts appearing in the gaps between mounts, which is
          where a parent is looking at their child. */}
      <PlayfulBackdrop level="quiet" />

      {/* The one place per role the play voice appears. A parent opens this
          screen more than every other screen in the app combined, so the
          greeting belongs here and the rest of their day stays in the working
          faces. */}
      <HeaderBar
        hero
        play
        translucent
        mascot="idle"
        title="Moments"
        eyebrow={eyebrow}
        scrollY={scrollY}
      />

      {/**
       * The switcher sits **above** the list, not inside it as
       * `ListHeaderComponent`.
       *
       * FlashList pins a sticky row to the top of its viewport as soon as that
       * row is the current sticky index — it does not wait for the row to
       * actually reach the top, and it does not offset the pinned copy by the
       * list header's height. With the switcher inside the list that put the
       * pinned day header directly on top of it: the switcher was invisible at
       * rest, and the day header appeared twice, once pinned and once in flow a
       * switcher's height below. Only at scroll 0 — which is exactly where a
       * parent opens the app.
       *
       * Outside the list, data index 0 *is* the top, so the pinned copy lands on
       * its own row and the two coincide. The switcher also stops scrolling
       * away, which matches what the loading state already did.
       */}
      {ListHeader}

      <FlashList
        data={rows}
        renderItem={renderRow}
        keyExtractor={rowKey}
        getItemType={rowType}
        // No `stickyHeaderIndices`, and it is not an oversight.
        //
        // FlashList pins a sticky row as soon as it becomes the current sticky
        // index rather than when it reaches the top, so **the first day header
        // is rendered twice** — once pinned, once in flow — for the whole
        // stretch between scroll 0 and roughly 120px. At exactly 0 the two
        // coincide and it looks fine; a flick apart and the in-flow copy's meta
        // line appears about 19px under the pinned one, so the feed opens on
        // "Today / 9 photos · Sarita / 9 photos · Sarita". Measured at deltas
        // 0, 40, 80 and 120: two copies every time.
        //
        // The header is already opaque, which is the usual fix, and it does not
        // help — the two copies are at different offsets, so the pinned one's
        // background only covers the part of the other it happens to overlap.
        //
        // Pinning is worth something on a long day, but not at the cost of a
        // doubled heading at the top of the screen every parent opens first.
        // Day headers now scroll with their photographs.
        //
        // `stickyIndices` is still computed by `buildFeedLayout` and is still
        // correct; if FlashList's pinning is fixed upstream, pass it again.
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.6}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            // The readable marigold: `primary.amber` is 2.03:1 and a spinner
            // drawn in it disappears against paper.
            tintColor={colors.primary.amberDark}
            colors={[colors.primary.amberDark]}
            progressBackgroundColor={colors.background.surface}
          />
        }
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          // Three different kinds of empty, because they are three different
          // situations. A failed request dressed up as an empty album tells a
          // parent their child had no day, which is the worse lie.
          //
          // The host view is load-bearing: FlashList drops the empty component
          // straight into the scroll content, where `EmptyState`'s own `flex: 1`
          // resolves against a container sized by its content and collapses the
          // whole panel to nothing. The floor gives it something to fill.
          <View style={styles.emptyHost}>
            {isFeedError ? (
              <EmptyState
                variant="error"
                title="Couldn't load photos."
                message="It may just be the connection. Try again in a moment."
                action={{ label: 'Try again', onPress: () => refetch() }}
              />
            ) : children.length === 0 ? (
              <EmptyState
                variant="first-use"
                illustration="school"
                title="No children linked yet."
                message={
                  'Your school links your child to your account. Ask them to check this address:\n\n' +
                  userEmail
                }
              />
            ) : (
              <EmptyState
                variant="first-use"
                title="No photos yet."
                message={`When ${firstName(named?.fullName) ?? 'your child'}'s teacher shares a moment, it will appear here.`}
              />
            )}
          </View>
        }
      />

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

/**
 * The wall's outer margin is deliberately half the usual screen padding: every
 * mount carries its own white mat, and a 24pt gutter around an 8pt mat reads as
 * a photograph lost inside two frames.
 */
const EDGE = spacing.sm;

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: EDGE,
    paddingBottom: layout.tabBarClearance,
  },
  listHeader: {
    // Cancels the list's own inset so the switcher scrolls edge to edge while
    // the mounts stay in.
    marginHorizontal: -EDGE,
    paddingBottom: spacing.xs,
  },
  /** Puts the inset back when the same block is drawn outside the list. */
  loadingHeader: {
    paddingHorizontal: EDGE,
  },

  // ── The day header ──
  //
  // Inset to line up with the **paper edge of the mounts**, not with the
  // photographs inside them: the header names the day's prints, and a label
  // that starts inboard of the object it labels reads as belonging to nothing.
  dayHeader: {
    backgroundColor: colors.background.cream,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
    marginBottom: spacing.ms,
  },
  dayMeta: {
    marginTop: spacing.xxs,
  },

  // ── Rows ──
  heroRow: {
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.ms,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
    marginBottom: spacing.ms,
  },
  pairCell: {
    flex: 1,
  },
  /** Flips a two-column row, so a mirrored triptych puts its tall print right. */
  rowMirrored: {
    flexDirection: 'row-reverse',
  },
  /**
   * The asymmetric spread.
   *
   * `flex-end` rather than `flex-start`: the two prints are different sizes and
   * different shapes, so aligning their tops leaves a ragged gap under the
   * shorter one. Aligning their feet reads as two prints standing on a shelf,
   * which is both tidier and the idiom the rest of this wall uses.
   */
  duoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
    marginBottom: spacing.ms,
  },
  duoBig: {
    flex: DUO_BIG_FLEX,
  },
  duoSmall: {
    flex: 1,
  },
  trioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // Wider than the other rows: the prints are tilted, and a rotated corner
    // needs somewhere to go or it clips against the list's edge.
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.ms,
  },
  trioCell: {
    flex: 1,
  },

  // ── The arrivals strip ──
  strip: {
    paddingHorizontal: spacing.ms,
    paddingTop: spacing.xs,
  },
  stripBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primary.amberWash,
  },
  stripText: {
    flex: 1,
  },
  stripDismiss: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },

  /**
   * A floor under the empty states.
   *
   * FlashList renders `ListEmptyComponent` as a plain child of the scroll
   * content, which is sized by what is in it — so a panel that asks for
   * `flex: 1` gets a flex basis of zero, no free space to grow into, and a
   * height of nothing. The state is then perfectly correct and perfectly
   * invisible.
   */
  emptyHost: {
    minHeight: 420,
  },
});
