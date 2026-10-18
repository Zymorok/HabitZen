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
  | 'archive'
  | 'home'
  | 'timer'
  | 'chart'
  | 'user'
  | 'heart'
  | 'more'
  | 'hand'
  | 'clock'
  | 'play'
  | 'reset'
  | 'menu'
  | 'sound'
  | 'soundOff'
  | 'sprout'
  | 'crown'
  | 'pencil'
  | 'calendar';
export function Icon({
  name,
  size = 22,
  color = '#2D6249',
  strokeWidth = 1.7,
  fill = 'none',
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
  /** Заливка для «полных» значков (росток и лист на таймере); по умолчанию — только контур. */
  readonly fill?: string;
}) {
  const common = {
    stroke: color,
    strokeWidth,
    fill,
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
      {name === 'home' ? (
        <Path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z" />
      ) : null}
      {name === 'timer' ? (
        <>
          <Circle cx="12" cy="13" r="8" />
          <Path d="M12 9v4l2.5 2M10 2h4" />
        </>
      ) : null}
      {name === 'chart' ? <Path d="M5 20V11M12 20V5M19 20v-7M3 20h18" /> : null}
      {name === 'user' ? (
        <>
          <Circle cx="12" cy="8" r="4" />
          <Path d="M4 21c1-4.5 4.5-6 8-6s7 1.5 8 6" />
        </>
      ) : null}
      {name === 'heart' ? (
        <Path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.5 3.8 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 15.4 12 20 12 20Z" />
      ) : null}
      {name === 'more' ? (
        <>
          <Circle cx="12" cy="5" r="1" />
          <Circle cx="12" cy="12" r="1" />
          <Circle cx="12" cy="19" r="1" />
        </>
      ) : null}
      {name === 'hand' ? (
        <Path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5c0 3.6-2.6 6.5-6.2 6.5-2.3 0-3.7-1-5-2.6L4.6 15a1.5 1.5 0 0 1 2.3-2L9 15" />
      ) : null}
      {name === 'clock' ? (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7v5l3 2" />
        </>
      ) : null}
      {name === 'walk' ? (
        <>
          <Circle cx="13" cy="4" r="2" />
          <Path d="m9 21 2-6 3 2v4M8 11l3-3 3 1 2 3M11 8l-1 7" />
        </>
      ) : null}
      {name === 'play' ? <Path d="M8 5.5v13l10.5-6.5L8 5.5Z" /> : null}
      {name === 'reset' ? (
        <>
          <Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
          <Path d="M19.5 4.5v4h-4" />
        </>
      ) : null}
      {name === 'menu' ? <Path d="M4 7h16M4 12h16M4 17h16" /> : null}
      {name === 'sound' ? (
        <>
          <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
          <Path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
        </>
      ) : null}
      {name === 'soundOff' ? (
        <>
          <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
          <Path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
        </>
      ) : null}
      {name === 'sprout' ? (
        <>
          <Path d="M12 20v-8" />
          <Path d="M12 12c0-4 2.6-6.5 7-6.5 0 4.3-2.6 6.5-7 6.5Z" />
          <Path d="M12 14.5c0-3.3-2.2-5.5-6.5-5.5 0 3.5 2.4 5.5 6.5 5.5Z" />
        </>
      ) : null}
      {name === 'crown' ? (
        <Path d="M4 17.5h16M5 15 3.5 7.5 8.5 11 12 5l3.5 6 5-3.5L19 15H5Z" />
      ) : null}
      {name === 'pencil' ? (
        <>
          <Path d="M5 19l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L9 17.5 5 19Z" />
          <Path d="m14 6.5 3 3" />
        </>
      ) : null}
      {name === 'calendar' ? (
        <>
          <Rect x="4" y="5.5" width="16" height="14.5" rx="3" />
          <Path d="M8 3.5v4M16 3.5v4M4 10h16" />
        </>
      ) : null}
    </Svg>
  );
}
