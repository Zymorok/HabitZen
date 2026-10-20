import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gardenLevel } from '@habitzen/core/garden';
import { useAuth } from '../../core/auth/AuthProvider';
import { useGarden } from '../garden/data/useGarden';
import { useActiveHabits } from '../habits/data/useHabits';
import { useStreak } from '../today/data/usePlan';
import { evaluateAchievements, newlyUnlocked } from './rules';
import type { Achievement } from './rules';

const SEEN_KEY = 'habitzen.achievements.seen.v1';

/** Достижения по данным сада, серии и списка привычек; null — данные ещё не пришли. */
export function useAchievements(): Achievement[] | null {
  const garden = useGarden();
  const streak = useStreak();
  const habits = useActiveHabits();
  return useMemo(() => {
    if (!garden.data || !streak.data || !habits.data) return null;
    return evaluateAchievements({
      completedTotal: garden.data.completedTotal,
      perfectDays: garden.data.perfectDays,
      bestStreak: streak.data.best,
      frozenDays: streak.data.frozen.length,
      level: gardenLevel(garden.data.completedTotal).level,
      habits: habits.data.length,
    });
  }, [garden.data, streak.data, habits.data]);
}

/**
 * Новые достижения для всплывающей плашки. «Увидено» хранится на устройстве по аккаунту,
 * как «Новый уровень!» у дерева: плашка появляется один раз.
 */
export function useNewAchievement() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const list = useAchievements();
  const [fresh, setFresh] = useState<Achievement | null>(null);
  // NOTE: Пересчёт плашки — только когда изменился набор открытых значков, а не на каждый рендер.
  const latest = useRef(list);
  latest.current = list;
  const unlockedKey = list
    ?.filter((item) => item.unlocked)
    .map((item) => item.key)
    .join('|');

  useEffect(() => {
    const current = latest.current;
    if (!userId || !current || unlockedKey === undefined) return;
    let active = true;
    const key = `${SEEN_KEY}:${userId}`;
    void (async () => {
      let seen: Set<string> | null = null;
      try {
        const raw = await AsyncStorage.getItem(key);
        seen = raw === null ? null : new Set(raw ? raw.split('|') : []);
        await AsyncStorage.setItem(key, unlockedKey);
      } catch {
        // NOTE: Хранилище недоступно — просто не показываем плашку, экран достижений работает.
        return;
      }
      const next = newlyUnlocked(current, seen);
      if (active && next.length > 0) setFresh(next[next.length - 1] ?? null);
    })();
    return () => {
      active = false;
    };
  }, [userId, unlockedKey]);

  const dismiss = useCallback(() => setFresh(null), []);
  return { fresh, dismiss };
}
