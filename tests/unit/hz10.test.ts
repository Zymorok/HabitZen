import { describe, expect, it } from 'vitest';
import { suggestIcon, TEMPLATES } from '../../apps/mobile/src/features/habits/templates';
import { mergeOrder } from '../../apps/mobile/src/features/habits/order';
import { dayMotto } from '../../apps/mobile/src/features/today/motto';
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  newlyUnlocked,
} from '../../apps/mobile/src/features/achievements/rules';
import { ICON_CHOICES } from '../../apps/mobile/src/shared/habit-look';

/** HZ-10: автоподбор значка, шаблоны, порядок раздела, подсказка дня и достижения. */

describe('значок по названию', () => {
  it('узнаёт привычку на трёх языках', () => {
    expect(suggestIcon('Выпить воду')).toBe('drop');
    expect(suggestIcon('Бег по утрам')).toBe('run');
    expect(suggestIcon('Читати 20 хвилин')).toBe('book');
    expect(suggestIcon('Morning run')).toBe('run');
    expect(suggestIcon('Лечь спать до 23:00')).toBe('moon');
    expect(suggestIcon('Витамины')).toBe('pill');
    expect(suggestIcon('Английский')).toBe('system');
  });
  it('ищет по началу слова и ничего не выдумывает', () => {
    // NOTE: «среда» не должна находить «еда».
    expect(suggestIcon('Каждая среда')).toBeNull();
    expect(suggestIcon('Привычка')).toBeNull();
    expect(suggestIcon('')).toBeNull();
  });
});

describe('шаблоны «Быстрый старт»', () => {
  it('у каждого шаблона значок из списка формы и разумная цель', () => {
    const icons = new Set(ICON_CHOICES.map((choice) => choice.icon));
    for (const template of TEMPLATES) {
      expect(icons.has(template.icon)).toBe(true);
      expect(template.goalTarget).toBeGreaterThanOrEqual(1);
      if (template.frequency === 'weekly') expect(template.perWeek).toBeGreaterThan(0);
    }
    expect(new Set(TEMPLATES.map((template) => template.key)).size).toBe(TEMPLATES.length);
  });
});

describe('порядок раздела внутри общего списка', () => {
  it('переставляет только свои привычки, остальные стоят на местах', () => {
    expect(mergeOrder(['a', 'b', 'c', 'd', 'e'], ['d', 'b'])).toEqual(['a', 'd', 'c', 'b', 'e']);
    expect(mergeOrder(['a', 'b', 'c'], ['c', 'b', 'a'])).toEqual(['c', 'b', 'a']);
    // NOTE: Привычка из архива (есть в плане, нет в списке) не ломает порядок.
    expect(mergeOrder(['a', 'b'], ['x', 'b', 'a'])).toEqual(['b', 'a']);
  });
});

describe('подсказка под кольцом дня', () => {
  it('с чего начать, сколько осталось, всё ли сделано', () => {
    expect(dayMotto(0, 3)).toEqual({ key: 'motto_start' });
    expect(dayMotto(1, 3)).toEqual({ key: 'motto_left', options: { count: 2 } });
    expect(dayMotto(3, 3)).toEqual({ key: 'day_complete' });
    expect(dayMotto(0, 0)).toEqual({ key: 'motto_optional' });
  });
});

describe('достижения', () => {
  const base = {
    completedTotal: 0,
    perfectDays: 0,
    bestStreak: 0,
    frozenDays: 0,
    level: 1,
    habits: 0,
  };
  it('открываются по порогам и показывают прогресс до цели', () => {
    const list = evaluateAchievements({ ...base, completedTotal: 60, bestStreak: 5, habits: 3 });
    const byKey = new Map(list.map((item) => [item.key, item]));
    expect(byKey.get('first_step')?.unlocked).toBe(true);
    expect(byKey.get('completions_50')?.unlocked).toBe(true);
    expect(byKey.get('streak_3')?.unlocked).toBe(true);
    expect(byKey.get('streak_7')).toMatchObject({ unlocked: false, value: 5, goal: 7 });
    expect(byKey.get('completions_200')?.value).toBe(60);
    expect(list).toHaveLength(ACHIEVEMENTS.length);
  });
  it('плашка — только для новых, и не при самом первом расчёте', () => {
    const list = evaluateAchievements({ ...base, completedTotal: 1, habits: 3 });
    expect(newlyUnlocked(list, null)).toEqual([]);
    expect(newlyUnlocked(list, new Set(['first_step'])).map((item) => item.key)).toEqual([
      'collector',
    ]);
    expect(newlyUnlocked(list, new Set(['first_step', 'collector']))).toEqual([]);
  });
});
