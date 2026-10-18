import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthProvider';
import { fetchCalendarDays, fetchHabitDays } from './progress-api';

/** Ключи кэша; команды плана сбрасывают их, чтобы календарь сразу видел новую отметку. */
export const CALENDAR_KEY = 'calendar-days';
export const HABIT_DAYS_KEY = 'habit-days';

export function useCalendarDays(from: string, to: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: [CALENDAR_KEY, userId, from, to],
    queryFn: () => fetchCalendarDays(from, to),
    enabled: Boolean(userId),
    // NOTE: При перелистывании месяца прежний остаётся на экране, пока грузится новый.
    placeholderData: (previous) => previous,
  });
}

export function useHabitDays(habitId: string | undefined, days = 366) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: [HABIT_DAYS_KEY, userId, habitId, days],
    queryFn: () => fetchHabitDays(habitId ?? '', days),
    enabled: Boolean(userId && habitId),
  });
}
