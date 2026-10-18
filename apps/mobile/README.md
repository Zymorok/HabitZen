# Мобильное приложение

Рабочий первый запуск на Expo SDK 57 / React Native 0.86.3. Маршруты: `/`, `/preferences?section=language`, `/preferences?section=theme`, `/permissions`. Пять вводных страниц относятся только к кадру 01. Начало работы и вход отключены.

Подключены Expo Router, TypeScript, NativeWind 4, Reanimated 4, Gesture Handler, react-i18next, expo-localization, AsyncStorage, Notifications и Haptics. Выбор языка и темы сохраняется локально. Переводы находятся в resources/locales. Логи телефона ограничены 80 безопасными событиями.

Из корня: `npm run web -- --port 8097`. Android: `npm run android --workspace @habitzen/mobile -- --port 8097`. Системное разрешение уведомлений работает в нативной сборке; браузер объясняет ограничение платформы. Расписания пока не создаются. Папки android/ios генерируются Expo Prebuild и не хранятся в Git. Тесты находятся только в корневом tests/.
