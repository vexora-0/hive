import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  colors,
  spacing,
  radius,
  duration,
  timing,
  withAlpha,
  MIN_TAP_SIZE,
  STALE_TIME_MS,
} from '@/theme';
import { Text, Button } from '@/components/ui';
import { PhotoViewer, type ViewerPhoto } from '@/components/media';
import { EmptyState, SKELETON_DELAY } from '@/components/feedback';
import { ScreenContainer } from '@/components/layout';
import { HeaderBar } from '@/components/navigation';
import { Reveal } from '@/components/animation';
import { useChildren } from '@/features/parent/hooks/useChildren';
import {
  getPhotoDetails,
  type FeedPage,
  type FeedPhoto,
} from '@/features/parent/services/parentService';

// ---------------------------------------------------------------------------
// What the foot of the screen needs to know
// ---------------------------------------------------------------------------

/**
 * The subset of a photograph this screen writes about.
 *
 * Both shapes it can be handed satisfy it — the detail endpoint's
 * `PhotoDetails` and the feed's `FeedPhoto` — which is what lets a parent swipe
 * from the photo they opened into its neighbours without a second request.
 */
interface PhotoCaptionSource {
  id: string;
  createdAt: string;
  uploadedBy: { name: string | null };
  studentIds: string[];
}

// ---------------------------------------------------------------------------
// Dates and ages
// ---------------------------------------------------------------------------

/** Relative where a parent thinks relatively, human after that. Never raw. */
function relativeDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** First name only. A caption line has no room for the family name. */
function firstName(name?: string | null): string | undefined {
  if (!name) return undefined;
  return name.trim().split(/\s+/)[0];
}

/**
 * How old the child was **on the day the photograph was taken** — "3y 2m".
 *
 * The whole-month count borrows a month when the day of the month has not come
 * round yet, so a child born on the 28th is not aged up on the 3rd. A date of
 * birth in the future, or a photo predating it, returns nothing rather than a
 * negative age: seeded and demo data both produce that, and "-0y 1m" under a
 * child's face is worse than no line at all.
 */
function ageAt(dateOfBirth: string, takenAt: string): string | null {
  const born = new Date(dateOfBirth);
  const taken = new Date(takenAt);
  if (Number.isNaN(born.getTime()) || Number.isNaN(taken.getTime())) return null;

  let months =
    (taken.getFullYear() - born.getFullYear()) * 12 +
    (taken.getMonth() - born.getMonth());
  if (taken.getDate() < born.getDate()) months -= 1;

  if (months < 0) return null;
  if (months < 12) return `${months}m`;

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years}y` : `${years}y ${rest}m`;
}

// ---------------------------------------------------------------------------
// The neighbouring photographs
// ---------------------------------------------------------------------------

/**
 * The rest of the wall, taken from the feed's own cache.
 *
 * A viewer a parent cannot swipe out of is a viewer they have to close and
 * reopen for every photograph of their child's morning. The feed has already
 * fetched the run they were scrolling, so the gallery costs one cache read and
 * no request — and it stays in the feed's order, which is the order the day
 * happened.
 *
 * **Snapshotted once, on mount.** `PhotoViewer`'s index is uncontrolled: if a
 * background refetch prepended a photograph to this array mid-swipe, every page
 * would shift by one under the finger.
 */
function useFeedNeighbours(photoId?: string): FeedPhoto[] {
  const queryClient = useQueryClient();

  const [snapshot] = useState<FeedPhoto[]>(() => {
    if (!photoId) return [];

    const caches = queryClient.getQueriesData<InfiniteData<FeedPage>>({
      queryKey: ['feed'],
    });

    for (const [, data] of caches) {
      if (!data?.pages) continue;
      const photos = data.pages.flatMap((page) => page.photos);
      if (photos.some((p) => p.id === photoId)) return photos;
    }

    return [];
  });

  return snapshot;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * What stands in for the photograph while its record is being fetched.
 *
 * Not a spinner on black. A spinner says the app is busy, which the parent
 * already knows; an empty print-shaped plate says a photograph is arriving and
 * roughly what shape it will be, on the ground it will arrive on. It waits out
 * the same 200ms every skeleton in the app does, so a photo already in cache
 * goes straight up with nothing flashing behind it.
 *
 * The close button is drawn during the load on purpose: a request that never
 * finishes must not be a room with no door.
 */
function LoadingFrame({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const appear = useSharedValue(0);

  React.useEffect(() => {
    appear.value = withDelay(SKELETON_DELAY, withTiming(1, timing(duration.fast)));
  }, [appear]);

  const appearStyle = useAnimatedStyle(() => ({ opacity: appear.value }));

  return (
    <View style={styles.viewerGround}>
      <Animated.View
        style={[styles.plate, appearStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <View style={[styles.chrome, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          <Ionicons name="close" size={22} color={colors.text.onInk} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * One photograph, held up to the light.
 *
 * The ground is `viewer.ground` rather than ink: a C\*7.5 violet surround
 * measurably shifts the apparent white balance of the picture inside it, and a
 * near-neutral one does not. Everything else on the screen is either the
 * photograph or one line about it.
 *
 * The line that matters is **the age stamp** — "Aarav · 3y 2m". It is one date
 * subtraction against data the app already holds, and it is the single thing
 * that turns a photo library into a keepsake: in five years the picture will
 * still be here, and the only fact nobody will be able to reconstruct is how
 * small he was. It is set in the editorial italic, the one such line this
 * screen is allowed.
 *
 * A print is ordered **from here**, from the photograph on screen, never from a
 * second and worse gallery bolted onto the orders tab. And there are no likes,
 * no view counts and no reaction totals — on a child's photograph those are
 * politically impossible to remove once shipped.
 */
export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    data: photo,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['photo', id],
    queryFn: () => getPhotoDetails(id!),
    enabled: !!id,
    staleTime: STALE_TIME_MS,
  });

  const neighbours = useFeedNeighbours(id);
  const { children } = useChildren();

  const startIndex = useMemo(() => {
    const found = neighbours.findIndex((p) => p.id === id);
    return found === -1 ? 0 : found;
  }, [neighbours, id]);

  const [page, setPage] = useState(startIndex);

  const handleClose = useCallback(() => router.back(), [router]);

  /**
   * The gallery, at full resolution.
   *
   * The feed hands `<PhotoMount>` the thumbnail because a two-up wall does not
   * need the file; a full-screen viewer does, and serving the thumbnail here is
   * the one mistake a keepsake app cannot make.
   */
  const gallery = useMemo<ViewerPhoto[] | undefined>(() => {
    if (neighbours.length === 0) return undefined;
    return neighbours.map((p) => ({
      id: p.id,
      uri: p.uri,
      blurhash: p.blurhash ?? undefined,
    }));
  }, [neighbours]);

  /** Whichever photograph is on screen — the swiped one, not the routed one. */
  const current: PhotoCaptionSource | undefined =
    neighbours.length > 0 ? (neighbours[page] ?? neighbours[startIndex]) : photo;

  const handleOrderPrint = useCallback(() => {
    router.push({
      pathname: '/(parent)/orders' as never,
      params: { photoId: current?.id ?? id },
    } as never);
  }, [router, current?.id, id]);

  /**
   * "Aarav · 3y 2m", for whichever of this parent's children are in the frame.
   *
   * A photograph tagged with two siblings names both — that is exactly the
   * picture a parent keeps. A child with no date of birth on file is still
   * named; the age is simply left off rather than guessed.
   */
  const ageLine = useMemo(() => {
    if (!current) return undefined;

    const tagged = children.filter((c) => current.studentIds.includes(c.id));
    if (tagged.length === 0) return undefined;

    return tagged
      .map((child) => {
        const name = firstName(child.fullName) ?? child.fullName;
        const age = child.dateOfBirth
          ? ageAt(child.dateOfBirth, current.createdAt)
          : null;
        return age ? `${name} · ${age}` : name;
      })
      .join('  ·  ');
  }, [children, current]);

  // ---- Loading -----------------------------------------------------------
  if (isLoading && neighbours.length === 0) {
    return <LoadingFrame onClose={handleClose} />;
  }

  // ---- Error / not found -------------------------------------------------
  //
  // On paper, not on the viewer ground: there is no photograph behind it, and a
  // message alone on black reads as a crash rather than as a sentence. The API
  // answers 404 rather than 403 for a photo this parent may not see, so a
  // missing photo and a refused one are deliberately shown the same way.
  if ((isError || !photo) && neighbours.length === 0) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <HeaderBar title="Photo" showBack onBack={handleClose} />
        <EmptyState
          variant="error"
          title="This photo didn't come through."
          message="It may just be the connection, or it may have been removed."
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      </ScreenContainer>
    );
  }

  const takenAt = current?.createdAt;
  const photographer = current?.uploadedBy.name;
  const meta = [takenAt ? relativeDay(takenAt) : null, photographer ? `by ${photographer}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.viewerGround}>
      <PhotoViewer
        photos={gallery}
        index={startIndex}
        onIndexChange={setPage}
        uri={photo?.uri}
        blurhash={photo?.blurhash ?? undefined}
        onClose={handleClose}
      />

      <View
        style={[
          styles.foot,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <View style={styles.footText}>
          {/* Arrives after the photograph has settled rather than with it —
              the picture is what the parent opened this screen for. */}
          {ageLine && (
            <Reveal delay={duration.base}>
              <Text variant="editorial" onInk numberOfLines={1}>
                {ageLine}
              </Text>
            </Reveal>
          )}

          {meta.length > 0 && (
            <Text variant="bodySmall" onInk muted style={styles.meta}>
              {meta}
            </Text>
          )}
        </View>

        <Button
          variant="primary"
          onPress={handleOrderPrint}
          accessibilityLabel="Order a print of this photo"
          leftIcon={<Ionicons name="cart-outline" size={17} color={colors.ink[900]} />}
        >
          Order a print
        </Button>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  viewerGround: {
    flex: 1,
    // Near-neutral, not ink and not black: a tinted surround shifts the
    // apparent white balance of the photograph sitting in it.
    backgroundColor: colors.viewer.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Loading ──
  plate: {
    width: '72%',
    aspectRatio: 0.8,
    borderRadius: radius.print,
    backgroundColor: withAlpha(colors.text.onInk, 0.06),
  },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.viewer.ground, 0.72),
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── The foot ──
  //
  // Flat, with no corner radius: a rounded panel over a photograph reads as a
  // card sitting on top of the picture, and this is meant to read as the foot
  // of the print itself. Its ground is the viewer's own at 0.9, which holds
  // `text.onInk` well above 4.5:1 over anything a photograph can put behind it.
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: withAlpha(colors.viewer.ground, 0.9),
  },
  footText: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  meta: {
    marginTop: spacing.xxs,
  },
});
