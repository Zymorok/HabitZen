import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Platform } from 'react-native';

export type IconName =
  | 'globe'
  | 'sun'
  | 'moon'
  | 'close'
  | 'check'
  | 'bell'
  | 'leaf'
  | 'book'
  | 'drop'
  | 'system'
  | 'settings'
  | 'arrow'
  | 'flame'
  | 'pause'
  | 'walk'
  | 'eye'
  | 'eyeOff'
  | 'logout'
  | 'plus'
  | 'archive';
export function Icon({
  name,
  size = 22,
  color = '#2D6249',
  strokeWidth = 1.7,
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
}) {
  const common = {
    stroke: color,
    strokeWidth,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const accessibility =
    Platform.OS === 'web' ? { 'aria-hidden': true as const } : { accessible: false };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...accessibility} {...common}>
      {name === 'globe' ? (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" />
        </>
      ) : null}
      {name === 'sun' ? (
        <>
          <Circle cx="12" cy="12" r="4" />
          <Path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </>
      ) : null}
      {name === 'moon' ? <Path d="M20.5 14a9 9 0 0 1-10.5-10.5A9 9 0 1 0 20.5 14Z" /> : null}
      {name === 'close' ? <Path d="m6 6 12 12M18 6 6 18" /> : null}
      {name === 'check' ? <Path d="m5 12 4.5 4.5L19 7" /> : null}
      {name === 'bell' ? (
        <>
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
          <Path d="M12 2V1" />
        </>
      ) : null}
      {name === 'leaf' ? (
        <>
          <Path d="M19 4C8 1 2 7 6 14c6 6 14 1 13-10Z" />
          <Path d="M4 21 15 9M9 17v-6m0 6h6" />
        </>
      ) : null}
      {name === 'book' ? (
        <>
          <Path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1ZM12 5v15" />
        </>
      ) : null}
      {name === 'drop' ? <Path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13Z" /> : null}
      {name === 'system' ? (
        <>
          <Rect x="3" y="3" width="18" height="14" rx="3" />
          <Path d="M8 21h8M12 17v4" />
        </>
      ) : null}
      {name === 'settings' ? (
        <>
          <Path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3Z" />
          <Circle cx="12" cy="12" r="3" />
        </>
      ) : null}
      {name === 'arrow' ? <Path d="m9 5 7 7-7 7" /> : null}
      {name === 'flame' ? (
        <Path d="M12 22c4 0 7-3 7-7 0-5-4-7-5-11-2 2-3 4-3 6-1-1-2-2-2-4-2 2-4 5-4 9 0 4 3 7 7 7Z" />
      ) : null}
      {name === 'pause' ? <Path d="M9 6v12M15 6v12" /> : null}
      {name === 'eye' ? (
        <>
          <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <Circle cx="12" cy="12" r="3" />
        </>
      ) : null}
      {name === 'eyeOff' ? (
        <>
          <Path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.3-.5 4.6-1.2" />
          <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      ) : null}
      {name === 'logout' ? (
        <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
      ) : null}
      {name === 'plus' ? <Path d="M12 5v14M5 12h14" /> : null}
      {name === 'archive' ? (
        <>
          <Rect x="3" y="4" width="18" height="5" rx="1.5" />
          <Path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
        </>
      ) : null}
      {name === 'walk' ? (
        <>
          <Circle cx="13" cy="4" r="2" />
          <Path d="m9 21 2-6 3 2v4M8 11l3-3 3 1 2 3M11 8l-1 7" />
        </>
      ) : null}
    </Svg>
  );
}
