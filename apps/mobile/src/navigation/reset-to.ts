import type { ImperativeRouter } from 'expo-router';

/**
 * Перейти на экран, очистив историю.
 * NOTE: После входа «назад» не должен вести на форму пароля, а после выхода —
 * на чужие привычки. Поэтому стек сбрасывается, а не дополняется.
 */
export function resetTo(router: ImperativeRouter, path: '/' | '/today'): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(path);
}

/**
 * «Фокус для привычки»: вкладка «Фокус» с уже выбранной привычкой.
 * NOTE: Как и нижнее меню, сначала закрываем экраны поверх вкладок — «назад» ведёт в план.
 */
export function openFocusFor(router: ImperativeRouter, habitId: string): void {
  if (router.canDismiss()) router.dismissAll();
  router.navigate({ pathname: '/focus', params: { habitId } });
}
