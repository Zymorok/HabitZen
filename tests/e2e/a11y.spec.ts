import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { completeHabit, signUp, uniqueEmail } from './helpers';

/**
 * HZ-07: доступность всех экранов по WCAG 2.1 A/AA (axe) в светлой и тёмной теме:
 * подписи полей и кнопок, роли, контраст текста.
 */
async function audit(page: Page, screen: string) {
  // NOTE: Ждём, пока экран дорисуется: появление идёт короткими анимациями.
  await page.waitForTimeout(700);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const problems = result.violations.map(
    (violation) => `${screen}: ${violation.id} — ${violation.nodes[0]?.target.join(' ') ?? ''}`,
  );
  expect(problems, problems.join('\n')).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`все экраны проходят проверку доступности (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.getByTestId('onboarding-shell')).toBeVisible();
    await audit(page, 'знакомство');
    await page.getByTestId('account-button').click();
    await audit(page, 'вход');
    await page.getByTestId('go-forgot').click();
    await audit(page, 'восстановление');

    await signUp(page, 'Доступность', uniqueEmail(`a11y-${scheme}`));
    await audit(page, 'пустой план');
    await page.getByTestId('today-create').click();
    await audit(page, 'новая привычка');
    await page.getByTestId('form-title').fill('Выпить воду');
    // NOTE: HZ-08 — цель с количеством, «N раз в неделю» и время дня тоже проверяются.
    await page.getByTestId('form-goal-count').click();
    await page.getByTestId('form-freq-weekly').click();
    await page.getByTestId('form-tod-morning').click();
    await audit(page, 'новая привычка с количеством');
    await page.getByTestId('form-freq-days').click();
    await page.getByTestId('form-submit').click();
    await expect(page.getByTestId('plan-row')).toBeVisible();
    await audit(page, 'план дня');
    await page.getByTestId('plan-row').click();
    await audit(page, 'удержание');
    await page.getByTestId('hold-back').click();
    // NOTE: Дальше обычная отметка удержанием: доводим «Выпить воду» до цели одним жестом.

    await completeHabit(page, 'Выпить воду');
    await expect(page.getByTestId('celebration-screen')).toBeVisible();
    await audit(page, 'награда');
    await page.getByTestId('celebration-ok').click();
    await page.getByTestId('today-tree').click();
    await audit(page, 'дерево');
    await page.getByTestId('tab-focus').click();
    await audit(page, 'фокус');
    await page.getByTestId('tab-progress').click();
    await audit(page, 'календарь');
    await page.getByTestId('open-week').click();
    await audit(page, 'итоги недели');
    await page.getByTestId('week-back').click();
    await page.getByTestId('progress-habit').first().click();
    await audit(page, 'привычка');
    await page.getByTestId('habit-stats-back').click();
    await page.getByTestId('tab-profile').click();
    await audit(page, 'настройки');
    await page.getByTestId('settings-reminders').click();
    await audit(page, 'напоминания');
  });
}
