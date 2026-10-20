// NOTE: Начальные значения сняты с визуального референса; точная подгонка выполняется по снимкам экранов.
export const lightTheme = {
  background: '#FBF8EF',
  surface: '#FFFCF4',
  surfaceMuted: '#E8EEDC',
  primary: '#2D6249',
  primarySoft: '#A9C7A3',
  text: '#172B22',
  textMuted: '#626B60',
  border: '#DCE1D2',
  accent: '#F3A16A',
  // NOTE: Чуть темнее исходного #3B8056: зелёный текст на кремовом фоне проходит контраст 4,5:1.
  success: '#357550',
  error: '#B64747',
} as const;

export const darkTheme = {
  background: '#14231E',
  surface: '#20362C',
  surfaceMuted: '#2A4335',
  primary: '#A7CEA2',
  primarySoft: '#385940',
  text: '#F6F3E8',
  textMuted: '#BDCAB9',
  border: '#3E5548',
  accent: '#F3B483',
  success: '#9ACD9A',
  error: '#F0A0A0',
} as const;

export type ThemeColors = { readonly [K in keyof typeof lightTheme]: string };

/** Цветовые темы приложения (HZ-08): «Лес» — исходная по макету, ещё три на выбор. */
export type AccentKey = 'forest' | 'sunset' | 'ocean' | 'lavender';
export const ACCENTS: readonly AccentKey[] = ['forest', 'sunset', 'ocean', 'lavender'];

export interface Palette {
  readonly light: ThemeColors;
  readonly dark: ThemeColors;
  /** Насыщенность дней календаря и годовой карты: 0 — пусто, 4 — сделано всё. */
  readonly shades: { readonly day: readonly string[]; readonly night: readonly string[] };
  /** Заливка главной кнопки и карточки «Итогов недели». */
  readonly gradient: {
    readonly day: readonly [string, string];
    readonly night: readonly [string, string];
  };
  /** Свечение главной кнопки и волна от пальца. */
  readonly glow: string;
  readonly ripple: string;
  readonly hover: string;
  /** Кольцо таймера фокуса (HZ-09): дорожка, градиент и свет за ним; перерыв — свой, персиковый. */
  readonly ring: { readonly day: RingColors; readonly night: RingColors };
}

export interface RingColors {
  readonly track: string;
  readonly from: string;
  readonly to: string;
  readonly glow: string;
}

// NOTE: «Выполнено» (success) во всех темах зелёное — это смысл, а не украшение.
// Контраст основного цвета на фоне каждой темы не ниже 4,5:1.
export const palettes: { readonly [K in AccentKey]: Palette } = {
  forest: {
    light: lightTheme,
    dark: darkTheme,
    shades: {
      day: ['#E7EDDD', '#D3E3C8', '#B4CFA6', '#86B283', '#3E7D50'],
      night: ['#2A4335', '#33553F', '#42704F', '#5E9466', '#A7CEA2'],
    },
    gradient: { day: ['#4A8259', '#2D6249'], night: ['#B2CFA3', '#87A67D'] },
    glow: '0 8px 18px rgba(29,70,48,0.34)',
    ripple: '#7FA978',
    hover: 'rgba(169,199,163,0.12)',
    ring: {
      day: { track: '#D3E3CB', from: '#5E9B6C', to: '#2D6249', glow: '#FFFDF5' },
      night: { track: '#2E4A3B', from: '#A7CEA2', to: '#6FA478', glow: '#1D3229' },
    },
  },
  sunset: {
    light: {
      ...lightTheme,
      background: '#FCF6EE',
      surface: '#FFFBF5',
      surfaceMuted: '#F6E7D9',
      primary: '#A84B29',
      primarySoft: '#EDB898',
      text: '#2E1C14',
      textMuted: '#6F5E54',
      border: '#ECDCCD',
      accent: '#E9A23B',
    },
    dark: {
      ...darkTheme,
      background: '#221914',
      surface: '#33241B',
      surfaceMuted: '#3E2D22',
      primary: '#F2B48C',
      primarySoft: '#5A3B2A',
      text: '#F8F0E6',
      textMuted: '#D2C0B2',
      border: '#4F3B2E',
      accent: '#F3C27A',
    },
    shades: {
      day: ['#F4E6DA', '#F1CDB3', '#E8A985', '#D47C52', '#A84B29'],
      night: ['#3E2D22', '#5A3B2A', '#80513A', '#B8704D', '#F2B48C'],
    },
    gradient: { day: ['#D07049', '#A84B29'], night: ['#F6C6A4', '#E59C72'] },
    glow: '0 8px 18px rgba(140,60,30,0.32)',
    ripple: '#E8A985',
    hover: 'rgba(237,184,152,0.14)',
    ring: {
      day: { track: '#F4DCCB', from: '#D07049', to: '#A84B29', glow: '#FFFAF3' },
      night: { track: '#4A3326', from: '#F2B48C', to: '#D98A5E', glow: '#2B1F18' },
    },
  },
  ocean: {
    light: {
      ...lightTheme,
      background: '#F4F8F9',
      surface: '#FBFDFD',
      surfaceMuted: '#DDEBEF',
      primary: '#245E78',
      primarySoft: '#9EC3D3',
      text: '#132730',
      textMuted: '#5B6B72',
      border: '#D3E1E6',
      success: '#2C7263',
    },
    dark: {
      ...darkTheme,
      background: '#0F1D24',
      surface: '#182C35',
      surfaceMuted: '#213A45',
      primary: '#9CCBE0',
      primarySoft: '#2F5263',
      text: '#EEF5F7',
      textMuted: '#B3C6CE',
      border: '#33505C',
      success: '#8CCDBA',
    },
    shades: {
      day: ['#E1ECEF', '#C3DCE6', '#93BFD1', '#5B97B3', '#245E78'],
      night: ['#213A45', '#2B4E5D', '#3A6779', '#5A8EA5', '#9CCBE0'],
    },
    gradient: { day: ['#3B7F9E', '#245E78'], night: ['#B4D9E9', '#86B6CB'] },
    glow: '0 8px 18px rgba(20,70,95,0.32)',
    ripple: '#7FB0C6',
    hover: 'rgba(158,195,211,0.14)',
    ring: {
      day: { track: '#CFE2EA', from: '#3B7F9E', to: '#245E78', glow: '#FAFDFE' },
      night: { track: '#2B4A57', from: '#9CCBE0', to: '#5E97B0', glow: '#14262E' },
    },
  },
  lavender: {
    light: {
      ...lightTheme,
      background: '#F8F6FB',
      surface: '#FDFCFF',
      surfaceMuted: '#EAE4F3',
      primary: '#5E4A8B',
      primarySoft: '#C3B5DF',
      text: '#221B30',
      textMuted: '#675F73',
      border: '#E0D9EB',
      accent: '#F0A27A',
    },
    dark: {
      ...darkTheme,
      background: '#1A1624',
      surface: '#272135',
      surfaceMuted: '#312942',
      primary: '#C9B8EE',
      primarySoft: '#463A63',
      text: '#F4F0FA',
      textMuted: '#C2B9D1',
      border: '#41385A',
    },
    shades: {
      day: ['#ECE7F4', '#D9CFEA', '#B9A8DA', '#8E78BF', '#5E4A8B'],
      night: ['#312942', '#41375A', '#56497A', '#7E6BAE', '#C9B8EE'],
    },
    gradient: { day: ['#7B66AE', '#5E4A8B'], night: ['#D7CAF3', '#AE9BD9'] },
    glow: '0 8px 18px rgba(70,50,120,0.32)',
    ripple: '#A897D2',
    hover: 'rgba(195,181,223,0.14)',
    ring: {
      day: { track: '#E0D7EF', from: '#7B66AE', to: '#5E4A8B', glow: '#FDFBFF' },
      night: { track: '#3D3452', from: '#C9B8EE', to: '#9783C7', glow: '#221C2E' },
    },
  },
};

export const layout = {
  referenceWidth: 390,
  screenPadding: 24,
  touchTargetMin: 48,
  cardRadius: 24,
  buttonRadius: 24,
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
} as const;
