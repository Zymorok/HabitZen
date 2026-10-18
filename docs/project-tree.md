# Дерево HabitZen

Проект создан в `C:\Users\vitalii\Desktop\HabitZen`. Основа HZ-01 дополнена рабочим первым запуском HZ-02. Реализован кадр 01; остальные кадры остаются планом.

```text
HabitZen/
├── .github/workflows/quality.yml    Проверки при изменениях
├── README.md
├── package.json                    Команды и рабочие пакеты
├── package-lock.json               Зафиксированные версии
├── tsconfig.json                   Строгая проверка типов
├── eslint.config.mjs               Правила кода
├── vitest.config.ts                Проверки общей логики
├── .env.example                    Образец без секретов
├── apps/mobile/
│   ├── README.md
│   ├── app.json                    Настройки Android/iOS/web и разрешений
│   ├── assets/illustrations/       Отдельные рисунки, без встроенного текста
│   └── src/
│       ├── app/                    Маршруты: index, preferences, permissions
│       ├── navigation/
│       │   └── screen-manifest.ts   Связь всех 12 кадров с функциями
│       ├── core/
│       │   ├── bootstrap/          Запуск и восстановление
│       │   ├── providers/          Контексты приложения
│       │   ├── i18n/               Связь переводов с React и ОС
│       │   ├── storage/            Секреты, кеш и миграции телефона
│       │   └── supabase/           Клиент и адаптеры сервера
│       ├── features/
│       │   ├── onboarding/         Первый запуск
│       │   ├── auth/               Аккаунт, вход и выход
│       │   ├── today/              Сегодняшний план
│       │   ├── habits/             Привычки и жесты
│       │   ├── focus/              Таймер, дыхание и звук
│       │   ├── progress/           Календарь, серии и история
│       │   ├── garden/             Дерево и награды
│       │   └── settings/           Язык, тема и предпочтения
│       ├── platform/permissions/   Разрешения ОС и честный вариант для web
│       ├── platform/contracts.ts   Уведомления, вибрация и звук
│       └── shared/                 Общие элементы интерфейса
├── packages/
│   ├── core/src/
│   │   ├── calendar.ts             Даты и часовые пояса
│   │   ├── streaks.ts              Правила серий
│   │   ├── timer.ts                Состояния таймера 25/5
│   │   └── ports.ts                Контракт записи результата
│   ├── design/src/
│   │   ├── tokens.ts               Палитры и размеры
│   │   └── motion.ts               Параметры движений
│   ├── i18n/src/
│   │   ├── catalogs.ts             Подключение словарей
│   │   ├── locales.ts              Язык устройства или ручной выбор
│   │   ├── translator.ts           Перевод и формы количества
│   │   └── formatters.ts           Даты, время и проценты
│   └── observability/src/
│       ├── logger.ts               Безопасный формат событий
│       └── node-sink.ts            Файлы, ротация и очистка
├── resources/
│   ├── assignment/                 Копии исходного задания и правил курса
│   ├── design/
│   │   └── reference.png           Согласованный макет
│   ├── assets/                     Место отдельных иллюстраций и звуков
│   └── locales/
│       ├── ru/                     Русские словари
│       ├── uk/                     Украинские словари
│       └── en/                     Английские словари
├── supabase/
│   ├── config.toml                 Локальный контур с Docker
│   ├── seed.sql                    Без постоянных паролей и аккаунтов
│   └── migrations/
│       ├── 20261017000100_foundation.sql
│       └── 20261017000200_access_policies.sql
├── tests/
│   ├── README.md                   Общая инструкция проверок
│   ├── unit/                       Правила, языки, логи, настройки и разрешения
│   ├── database/                   Ограничения и два аккаунта
│   ├── e2e/                        Исполняемые сценарии Playwright
│   └── native/                     Проверки платформы отдельно от исходников
├── scripts/
│   ├── check-architecture.mjs       Контроль зависимостей ядра
│   ├── verify-database.mjs          Временный PostgreSQL
│   └── log-demo.mts                 Проверка файловых логов
├── docs/
│   ├── architecture.md             Границы и причины решений
│   ├── project-tree.md             Это дерево
│   ├── requirements.md             Полный объём задания
│   ├── data-model.md               Таблицы и миграции
│   ├── ui-spec.md                  Экраны, состояния и анимации
│   ├── localization.md             Смена языка
│   ├── logging-and-storage.md      Логи и рабочие данные
│   ├── development.md              Локальное окружение
│   ├── decisions.md                Принятые решения
│   ├── roadmap.md                  Этапы реализации
│   └── verification.md             Проверено / не запускалось
└── storage/                        Рабочие данные вне Git
    ├── README.md
    ├── logs/<дата>/<уровень>/
    ├── reports/
    ├── runtime/
    ├── backups/
    └── tmp/
```

Каждая подготовленная папка функции содержит README с назначением. Внутренние screens/components/application/data появляются вместе с реальным кодом, без десятков пустых классов.

Четыре общих пакета разделяют независимые вещи: правила продукта, внешний вид, языки и диагностику. Порядок папок сам по себе не объявляется гарантией качества: границы подтверждаются проверками.

Подробности оболочки — docs/hz02-first-launch.md. Следующий этап HZ-03 подключает аккаунт и запись в PostgreSQL.
