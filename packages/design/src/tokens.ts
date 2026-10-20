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

export const layout = {
  referenceWidth: 390,
  screenPadding: 24,
  touchTargetMin: 48,
  cardRadius: 24,
  buttonRadius: 24,
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
} as const;
