import type { IconName } from '../../shared/ui/icon-names';

/**
 * Достижения (HZ-10): значки за серии, полные дни, число выполнений и рост дерева.
 * Всё выводится из уже подтверждённых сервером данных — подделать значок из приложения нельзя,
 * а отдельная таблица в базе не нужна. Чистые правила — их проверяют тесты.
 */
export interface AchievementInput {
  readonly completedTotal: number;
  readonly perfectDays: number;
  readonly bestStreak: number;
  readonly frozenDays: number;
  readonly level: number;
  readonly habits: number;
}

type Metric = keyof AchievementInput;

export interface AchievementRule {
  readonly key: string;
  readonly icon: IconName;
  readonly metric: Metric;
  readonly goal: number;
}

export interface Achievement extends AchievementRule {
  readonly value: number;
  readonly unlocked: boolean;
}

export const ACHIEVEMENTS: readonly AchievementRule[] = [
  { key: 'first_step', icon: 'check', metric: 'completedTotal', goal: 1 },
  { key: 'collector', icon: 'heart', metric: 'habits', goal: 3 },
  { key: 'streak_3', icon: 'flame', metric: 'bestStreak', goal: 3 },
  { key: 'streak_7', icon: 'flame', metric: 'bestStreak', goal: 7 },
  { key: 'full_days_7', icon: 'sun', metric: 'perfectDays', goal: 7 },
  { key: 'completions_50', icon: 'leaf', metric: 'completedTotal', goal: 50 },
  { key: 'freeze', icon: 'snowflake', metric: 'frozenDays', goal: 1 },
  { key: 'level_5', icon: 'sprout', metric: 'level', goal: 5 },
  { key: 'streak_30', icon: 'crown', metric: 'bestStreak', goal: 30 },
  { key: 'completions_200', icon: 'trophy', metric: 'completedTotal', goal: 200 },
];

export function evaluateAchievements(input: AchievementInput): Achievement[] {
  return ACHIEVEMENTS.map((rule) => {
    const value = Math.max(0, input[rule.metric]);
    return { ...rule, value: Math.min(value, rule.goal), unlocked: value >= rule.goal };
  });
}

/**
 * Что показать как «Новое достижение!». При самом первом расчёте (seen = null) ничего:
 * у давнего пользователя не должно выскочить десять значков разом.
 */
export function newlyUnlocked(
  list: readonly Achievement[],
  seen: ReadonlySet<string> | null,
): Achievement[] {
  if (seen === null) return [];
  return list.filter((achievement) => achievement.unlocked && !seen.has(achievement.key));
}
