/**
 * Media — everything that puts a photograph on screen.
 *
 * Four components, and the order they arrive in is the order a parent meets
 * them: {@link HiveImage} draws the pixels, {@link PhotoMount} mounts them on
 * paper, {@link MasonryGrid} hangs the mounts on a wall, and
 * {@link PhotoViewer} takes one down and holds it up to the light.
 *
 * Two rules run through all four, and both were bugs before they were rules:
 *
 *  - **A recycled cell must never paint the previous photograph.** Every image
 *    in a list carries a `recyclingKey`. In an app about other people's
 *    children a stale tile does not read as a loading state.
 *  - **The feed stays in the order it happened.** `MasonryGrid` keeps
 *    `optimizeItemArrangement` off, whatever the prop's name suggests.
 *
 * @see docs/design/UI-REVAMP-BRIEF.md §3 move 1, §9.7
 */

export { HiveImage } from './HiveImage';
export type { HiveImageProps } from './HiveImage';

export { PhotoMount } from './PhotoMount';
export type { PhotoMountProps } from './PhotoMount';

export { MasonryGrid } from './MasonryGrid';
export type { MasonryGridProps } from './MasonryGrid';

export { PhotoViewer } from './PhotoViewer';
export type { PhotoViewerProps, ViewerPhoto } from './PhotoViewer';
