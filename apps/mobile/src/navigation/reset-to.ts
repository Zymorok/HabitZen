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
