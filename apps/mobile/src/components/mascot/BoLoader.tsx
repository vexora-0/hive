import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import Svg, { Polygon } from 'react-native-svg';

import {
  colors,
  play,
  spacing,
  hexPoints,
  easing,
  useReducedMotion,
} from '@/theme';
import { Text } from '@/components/ui/Text';
import { Bo } from './Bo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoLoaderProps {
  /**
   * What is being waited for. **Say the noun** — "Loading photos", not
   * "Loading" — because this is what a screen reader announces and it is the
   * only part of the component that carries information.
   */
  label?: string;
  /** Overall diameter of the orbit in px. @default 132 */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** One full lap. Slow enough to look like flying rather than like spinning. */
const ORBIT_MS = 2800;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<BoLoader>` — Bo flying a lap of a comb cell while something loads.
 *
 * A spinner says *the system is busy*. A bee circling a cell says *we are
 * fetching your child's photographs*, which is the same fact with the product
 * in it, and it costs one SVG and one rotation.
 *
 * **The rotation is applied twice, in opposite directions.** The outer ring
 * carries Bo around the cell; the inner counter-rotation keeps her upright as
 * she goes, so she orbits rather than cartwheels. Without the second transform
 * the whole thing reads as a loading spinner with a bee stuck to it.
 *
 * Under Reduce Motion the orbit stops and Bo simply sits on the cell — the
 * label is doing the work of saying that something is happening, which is why
 * the label is required to name what.
 */
export function BoLoader({
  label = 'Loading',
  size = 132,
  style,
}: BoLoaderProps) {
  const reduced = useReducedMotion();
  const bee = Math.round(size * 0.42);
  const orbit = size - bee;

  return (
    <View
      style={[styles.host, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <View style={{ width: size, height: size }}>
        {/* The cell being circled — the app's own mark, at rest in the middle. */}
        <View style={styles.cell} pointerEvents="none">
          <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 100 100">
            <Polygon
              points={hexPoints(50, 50, 44)}
              fill={play.honey.soft}
              stroke={play.honey.deep}
              strokeWidth={5}
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        <MotiView
          style={styles.ring}
          from={{ rotate: '0deg' }}
          animate={{ rotate: reduced ? '0deg' : '360deg' }}
          transition={{
            type: 'timing',
            duration: ORBIT_MS,
            easing: easing.linear,
            loop: !reduced,
            repeatReverse: false,
          }}
        >
          <View style={[styles.beeSlot, { width: bee, height: bee }]}>
            <MotiView
              from={{ rotate: '0deg' }}
              animate={{ rotate: reduced ? '0deg' : '-360deg' }}
              transition={{
                type: 'timing',
                duration: ORBIT_MS,
                easing: easing.linear,
                loop: !reduced,
                repeatReverse: false,
              }}
            >
              <Bo pose="idle" size={bee} />
            </MotiView>
          </View>
          {/* Reserves the orbit radius, so the ring is as wide as the path Bo
              travels rather than as wide as Bo. */}
          <View style={{ height: orbit }} pointerEvents="none" />
        </MotiView>
      </View>

      <Text variant="bodySmall" color={colors.text.tertiary} center>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    gap: spacing.ms,
  },
  cell: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  beeSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BoLoader;
