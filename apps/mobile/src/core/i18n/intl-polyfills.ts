// NOTE: Hermes на Android не умеет Intl.PluralRules: без него i18next выбирает неверную форму
// слова — «7 дня подряд» вместо «7 дней подряд». Полифилы ставятся, только если чего-то нет
// (в браузере и в Node всё уже есть). Импортировать раньше всего остального.
import '@formatjs/intl-getcanonicallocales/polyfill';
import '@formatjs/intl-locale/polyfill';
import '@formatjs/intl-pluralrules/polyfill';
import '@formatjs/intl-pluralrules/locale-data/ru';
import '@formatjs/intl-pluralrules/locale-data/uk';
import '@formatjs/intl-pluralrules/locale-data/en';
