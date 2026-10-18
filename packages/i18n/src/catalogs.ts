import ru_common from '../../../resources/locales/ru/common.json';
import ru_onboarding from '../../../resources/locales/ru/onboarding.json';
import ru_auth from '../../../resources/locales/ru/auth.json';
import ru_habits from '../../../resources/locales/ru/habits.json';
import ru_focus from '../../../resources/locales/ru/focus.json';
import ru_progress from '../../../resources/locales/ru/progress.json';
import ru_settings from '../../../resources/locales/ru/settings.json';
import ru_notifications from '../../../resources/locales/ru/notifications.json';
import ru_errors from '../../../resources/locales/ru/errors.json';
import ru_permissions from '../../../resources/locales/ru/permissions.json';
import uk_common from '../../../resources/locales/uk/common.json';
import uk_onboarding from '../../../resources/locales/uk/onboarding.json';
import uk_auth from '../../../resources/locales/uk/auth.json';
import uk_habits from '../../../resources/locales/uk/habits.json';
import uk_focus from '../../../resources/locales/uk/focus.json';
import uk_progress from '../../../resources/locales/uk/progress.json';
import uk_settings from '../../../resources/locales/uk/settings.json';
import uk_notifications from '../../../resources/locales/uk/notifications.json';
import uk_errors from '../../../resources/locales/uk/errors.json';
import uk_permissions from '../../../resources/locales/uk/permissions.json';
import en_common from '../../../resources/locales/en/common.json';
import en_onboarding from '../../../resources/locales/en/onboarding.json';
import en_auth from '../../../resources/locales/en/auth.json';
import en_habits from '../../../resources/locales/en/habits.json';
import en_focus from '../../../resources/locales/en/focus.json';
import en_progress from '../../../resources/locales/en/progress.json';
import en_settings from '../../../resources/locales/en/settings.json';
import en_notifications from '../../../resources/locales/en/notifications.json';
import en_errors from '../../../resources/locales/en/errors.json';
import en_permissions from '../../../resources/locales/en/permissions.json';

// NOTE: Все начальные языки доступны без сети; словари разделены по смысловым областям.
export const catalogs = {
  ru: {
    common: ru_common,
    onboarding: ru_onboarding,
    auth: ru_auth,
    habits: ru_habits,
    focus: ru_focus,
    progress: ru_progress,
    settings: ru_settings,
    notifications: ru_notifications,
    errors: ru_errors,
    permissions: ru_permissions,
  },
  uk: {
    common: uk_common,
    onboarding: uk_onboarding,
    auth: uk_auth,
    habits: uk_habits,
    focus: uk_focus,
    progress: uk_progress,
    settings: uk_settings,
    notifications: uk_notifications,
    errors: uk_errors,
    permissions: uk_permissions,
  },
  en: {
    common: en_common,
    onboarding: en_onboarding,
    auth: en_auth,
    habits: en_habits,
    focus: en_focus,
    progress: en_progress,
    settings: en_settings,
    notifications: en_notifications,
    errors: en_errors,
    permissions: en_permissions,
  },
} as const;
