# Локальная работа

Node 24, npm 11; точные версии инструментов сохранены в package-lock.json. Git и Docker доступны на этой машине. Проект независим от окружения Telegram-бота.

## Основа

```powershell
npm ci
npm run check
npm run db:verify
npm run logs:demo
```

Команда check проверяет типы, стиль, форматирование, правила и границу чистого ядра. Это не сборка мобильного приложения.

db:verify использует PostgreSQL 17 в собственном временном Docker-контейнере без сети и опубликованных портов. Авторизация имитируется только для проверки SQL-политик. Это не тест настоящих JWT, Auth, API или Realtime.

## Полный Supabase

```powershell
npm run db:start
npm run db:migrate
npm run db:stop
```

Конфигурация: supabase/config.toml. Отдельный project_id — habitzen-local, API 55321, PostgreSQL 55322, Studio 55323, локальная тестовая почта 55324. Стандартный порт 5433 бота не используется.

Supabase CLI управляет томами PostgreSQL. В проекте нет команды сброса базы, удаления томов или применения к удалённой БД. Не запускать `supabase db reset` на рабочих данных.

Публичный клиентский ключ и URL берутся из конкретного запущенного окружения; в .env.example они не заполнены настоящими значениями. Никакой секрет не получает EXPO_PUBLIC_.

Подключение приложения (HZ-03): после `npm run db:start` создать `apps/mobile/.env.local` по образцу `.env.example` — `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321` и `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` из `npx supabase status -o env` (строка PUBLISHABLE_KEY). Файл не попадает в Git. После изменения файла перезапустить `npm run web`. Без файла знакомство работает, а экраны входа сообщают, что сервер не подключён.

Письма локального Auth (восстановление пароля) смотреть в Mailpit: http://127.0.0.1:55324. Адреса возврата из писем перечислены в supabase/config.toml (additional_redirect_urls); после правки конфигурации — `npm run db:stop` и `npm run db:start`.

На физическом телефоне 127.0.0.1 означает сам телефон. Для мобильной проверки нужен отдельно настроенный доступ только к API или тестовый облачный Supabase; открывать PostgreSQL/Studio в интернет не нужно.

## Мобильное приложение

apps/mobile содержит все 12 кадров макета (HZ-02–HZ-07). Из корня: `npm run web -- --port 8097`, открыть `http://localhost:8097`. При запущенном приложении и Supabase: `npm run test:e2e`.

Итоговая веб-сборка: `npm run export:web`, затем `npm run preview:web` (http://localhost:8098). Приложение одностраничное: хостинг должен отдавать index.html на любой адрес (/habits, /auth/callback). `expo serve` этого не делает, поэтому для показа используется scripts/serve-web.mjs. Проверка сборки: `HABITZEN_BASE_URL=http://localhost:8098 npm run test:e2e`.

Установлены Expo SDK 57.0.30, React Native 0.86.3, React 19.2.3, Router, NativeWind 4, Reanimated 4, Gesture Handler, i18n и AsyncStorage. Версии нативных модулей согласованы через expo install. React закреплён одинаково во всех рабочих пакетах.

Совместимость: `npx expo-doctor` из apps/mobile. Android: `npm run android --workspace @habitzen/mobile -- --port 8097`, нужны SDK и JDK. Для эмулятора: `adb reverse tcp:8097 tcp:8097` и для локального Supabase `adb reverse tcp:55321 tcp:55321`. После добавления нативных модулей (HZ-03: expo-secure-store, expo-crypto) Android-приложение пересобирается: `npx expo prebuild --platform android --no-install`, затем из apps/mobile/android `gradlew assembleDebug -PreactNativeArchitectures=x86_64 -PreactNativeDevServerPort=8097`. Платформенные папки генерируются из app.json. iOS требует отдельного устройства или внешней сборки; Xcode на Windows отсутствует.

После `expo prebuild` папка android пересоздаётся без `local.properties` — записать туда `sdk.dir=C:/Users/<имя>/AppData/Local/Android/Sdk`. Сборка для показа без сервера разработки (JS внутри APK): из apps/mobile/android `gradlew assembleRelease -PreactNativeArchitectures=x86_64` — файл `app/build/outputs/apk/release/app-release.apk`, подписан отладочным ключом и годится только для проверки. Release-сборка Android запрещает незашифрованный http, а локальный Supabase работает по http: для показа с локальным сервером в сгенерированной папке добавляется `app/src/release/AndroidManifest.xml` с `usesCleartextTraffic` (в Git не попадает). С настоящим сервером по https это не нужно.

## Облачный Supabase (HZ-11)

Облачный проект владельца — `qavwnuivhxfefqqtitoz.supabase.co`, все 9 миграций применены. Адрес и публичный ключ (`sb_publishable_…`) не секретны и попадают в приложение; служебный ключ и пароль базы в приложение и в Git не кладутся.

Сборка APK под облако — те же переменные в окружении поверх `.env.local` (Expo не перезаписывает уже заданные):

```bash
cd apps/mobile/android
EXPO_PUBLIC_SUPABASE_URL=https://qavwnuivhxfefqqtitoz.supabase.co EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<публичный ключ> ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
```

`arm64-v8a` — настоящие телефоны, `x86_64` — эмулятор. Сервер разработки (`npm run web`) по-прежнему работает с локальной базой.

В облаке включено подтверждение почты, а свой почтовый сервер (SMTP) не настроен: встроенная почта Supabase шлёт письма только участникам проекта и с жёстким лимитом. Поэтому регистрация с чужой почтой не дойдёт до письма; для проверки — почта владельца проекта или временно выключенное «Confirm email». Имя, пояс и язык при регистрации с подтверждением сохраняются в данных аккаунта и переносятся в профиль при первом входе. Обе ссылки из писем (подтверждение почты и новый пароль) ведут на `habitzen://auth/callback`; этот адрес (или `habitzen://**`) должен быть в Authentication → URL Configuration → Redirect URLs, иначе Supabase отправит человека на Site URL. Экран `auth/callback` сам различает письма: подтверждение сразу впускает в план дня, восстановление ведёт к новому паролю, устаревшая ссылка предлагает войти. Письмо нужно открывать на том же телефоне, где стоит приложение.

## Снимки и видео (HZ-07)

При запущенных приложении и Supabase: `npm run screens` — все 12 кадров в светлой и тёмной теме (storage/reports/screens), затем `py resources/design/screens/make_gallery.py` — галерея и сверка с макетом в docs/screens. `npm run demo:video` записывает прохождение в браузере, `py resources/design/screens/make_preview.py` делает из него анимированное превью docs/media/habitzen-demo.webp. Оба сценария создают одноразовые аккаунты hz-…@example.com и дописывают им историю только в локальной базе разработки. Для записи видео Playwright нужен его ffmpeg: `npx playwright install ffmpeg`.

[NativeWind](https://www.nativewind.dev/docs/getting-started/installation), [Expo monorepo](https://docs.expo.dev/guides/monorepos/), [локальный Supabase](https://supabase.com/docs/guides/local-development).
