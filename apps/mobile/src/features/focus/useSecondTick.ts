import { useEffect, useState } from 'react';

/**
 * Текущее время, обновляемое раз в секунду — только пока таймер идёт и экран на виду.
 * NOTE: Обновление подстроено под срок окончания: цифры меняются ровно на границе секунды
 * остатка, а не с опозданием до секунды.
 */
export function useSecondTick(active: boolean, deadlineMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const current = Date.now();
      const phase = deadlineMs === null ? current % 1000 : (deadlineMs - current) % 1000;
      const delay = deadlineMs === null ? 1000 - phase : phase > 0 ? phase : 1000;
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, delay + 8);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [active, deadlineMs]);
  return now;
}
