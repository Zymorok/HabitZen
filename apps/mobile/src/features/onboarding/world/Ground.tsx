import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useWorld } from './WorldContext';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { PAGE_COUNT } from './geometry';

/**
 * Земля под всеми страницами: волнистая травяная кромка переходит в песок,
 * а песок — в цвет фона под кнопками. Объекты страниц стоят на этой кромке.
 */
export function Ground() {
  const { palette } = useAppPreferences();
  const { width, height, groundY, night } = useWorld();
  const top = groundY - width * 0.07;
  const bandHeight = Math.max(40, height - top);
  const left = -width * 0.2;
  const bandWidth = width * (PAGE_COUNT + 0.4);
  const path = useMemo(() => {
    const edge = width * 0.07;
    const points: string[] = [`M0 ${bandHeight}`, `L0 ${edge}`];
    for (let x = 0; x <= bandWidth; x += width / 12) {
      // NOTE: Две синусоиды разной длины — кромка неровная, но без резких зубцов.
      const wave =
        Math.sin((x / width) * Math.PI * 1.4) * width * 0.014 +
        Math.sin((x / width) * Math.PI * 4.1 + 1.2) * width * 0.006;
      points.push(`L${x.toFixed(1)} ${(edge + wave).toFixed(1)}`);
    }
    points.push(`L${bandWidth} ${bandHeight}`, 'Z');
    return points.join(' ');
  }, [width, bandHeight, bandWidth]);
  const nightStyle = useAnimatedStyle(() => ({ opacity: night.value }));
  // NOTE: Доля высоты полосы, где песок уже растворился в фоне под кнопками.
  const fade = Math.min(0.75, (width * 0.42) / bandHeight);
  const box = { position: 'absolute' as const, left, top, width: bandWidth, height: bandHeight };
  return (
    <View pointerEvents="none" style={box}>
      <Svg width={bandWidth} height={bandHeight} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="groundDay" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#B4CB8E" />
            <Stop offset={String(fade * 0.16)} stopColor="#CBD6A2" />
            <Stop offset={String(fade * 0.45)} stopColor="#EADFC0" />
            <Stop offset={String(fade)} stopColor={palette.light.background} />
            <Stop offset="1" stopColor={palette.light.background} />
          </LinearGradient>
        </Defs>
        <Path d={path} fill="url(#groundDay)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, nightStyle]}>
        <Svg width={bandWidth} height={bandHeight}>
          <Defs>
            <LinearGradient id="groundNight" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#36543F" />
              <Stop offset={String(fade * 0.16)} stopColor="#2A4234" />
              <Stop offset={String(fade * 0.45)} stopColor="#1D3029" />
              <Stop offset={String(fade)} stopColor={palette.dark.background} />
              <Stop offset="1" stopColor={palette.dark.background} />
            </LinearGradient>
          </Defs>
          <Path d={path} fill="url(#groundNight)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
