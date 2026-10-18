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

На физическом телефоне 127.0.0.1 означает сам телефон. Для мобильной проверки нужен отдельно настроенный доступ только к API или тестовый облачный Supabase; открывать PostgreSQL/Studio в интернет не нужно.

## Мобильное приложение

apps/mobile содержит рабочий первый запуск. Из корня: `npm run web -- --port 8097`, открыть `http://localhost:8097`. При запущенном приложении: `npm run test:e2e`. Экспорт веб-версии: `npm run export:web`.

Установлены Expo SDK 57.0.30, React Native 0.86.3, React 19.2.3, Router, NativeWind 4, Reanimated 4, Gesture Handler, i18n и AsyncStorage. Версии нативных модулей согласованы через expo install. React закреплён одинаково во всех рабочих пакетах.

Совместимость: `npx expo-doctor` из apps/mobile. Android: `npm run android --workspace @habitzen/mobile -- --port 8097`, нужны SDK и JDK. Для эмулятора: `adb reverse tcp:8097 tcp:8097`. Платформенные папки генерируются из app.json. iOS требует отдельного устройства или внешней сборки; Xcode на Windows отсутствует.

[NativeWind](https://www.nativewind.dev/docs/getting-started/installation), [Expo monorepo](https://docs.expo.dev/guides/monorepos/), [локальный Supabase](https://supabase.com/docs/guides/local-development).
