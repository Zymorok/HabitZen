import { describe, expect, it } from 'vitest';
import {
  finishTimer,
  pauseTimer,
  reconcileTimer,
  remainingMs,
  resetTimer,
  startTimer,
} from '../../packages/core/src/timer.ts';

describe('Таймер при сворачивании и повторных действиях', () => {
  it('сохраняет правильный остаток после десяти минут без отрисовки', () => {
    const running = startTimer(resetTimer('focus'), 1000);
    expect(remainingMs(running, 601000)).toBe(900000);
  });
  it('завершается при возвращении после истечения срока', () => {
    const running = startTimer(resetTimer('focus'), 1000);
    expect(reconcileTimer(running, 1600000)).toEqual({ status: 'finished', phase: 'focus' });
  });
  it('удерживает остаток на паузе и правильно продолжает', () => {
    const paused = pauseTimer(startTimer(resetTimer('focus'), 1000), 61000);
    expect(remainingMs(paused, 3600000)).toBe(1440000);
    expect(remainingMs(startTimer(paused, 3600000), 3660000)).toBe(1380000);
  });
  it('повторное нажатие запуска не продлевает занятие', () => {
    const running = startTimer(resetTimer('focus'), 1000);
    expect(startTimer(running, 100000)).toBe(running);
  });
  it('не показывает отрицательное время', () => {
    expect(remainingMs(startTimer(resetTimer('break'), 1000), 900000)).toBe(0);
  });
  it('пауза после истечения срока считается завершением', () => {
    expect(pauseTimer(startTimer(resetTimer('break'), 1000), 900000)).toEqual({
      status: 'finished',
      phase: 'break',
    });
  });
  it('завершение не запускает следующий период автоматически', () => {
    const finished = finishTimer(resetTimer('focus'));
    expect(startTimer(finished, 1000)).toBe(finished);
  });
});
