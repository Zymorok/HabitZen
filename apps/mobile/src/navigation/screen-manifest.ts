export const screenManifest = [
  { frame: '01', feature: 'onboarding', route: '/(onboarding)' },
  { frame: '02', feature: 'today', route: '/(app)/(tabs)' },
  { frame: '03', feature: 'habits', route: '/(app)/habit/create' },
  { frame: '04', feature: 'habits', state: 'holding' },
  { frame: '05', feature: 'habits', state: 'saved' },
  { frame: '06', feature: 'focus', route: '/(app)/(tabs)/timer', state: 'focus' },
  { frame: '07', feature: 'focus', route: '/(app)/(tabs)/timer', state: 'break' },
  { frame: '08', feature: 'progress', route: '/(app)/(tabs)/stats' },
  { frame: '09', feature: 'habits', route: '/(app)/habit/[id]' },
  { frame: '10', feature: 'garden', route: '/(app)/garden' },
  { frame: '11', feature: 'garden', route: '/(app)/celebration' },
  { frame: '12', feature: 'settings', route: '/(app)/(tabs)/settings' },
] as const;
// NOTE: Манифест связывает макет с функциями; Expo Router позже получит реальные файлы маршрутов.
