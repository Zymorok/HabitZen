import { describe, expect, it } from 'vitest';
import {
  clockText,
  finishTimer,
  pauseTimer,
  reconcileTimer,
  remainingMs,
  remainingShare,
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

describe('Отображение таймера', () => {
  it('показывает минуты и секунды с округлением вверх', () => {
    expect(clockText(25 * 60 * 1000)).toBe('25:00');
    expect(clockText(1478001)).toBe('24:39');
    expect(clockText(1478000)).toBe('24:38');
    expect(clockText(400)).toBe('00:01');
    expect(clockText(0)).toBe('00:00');
    expect(clockText(-5000)).toBe('00:00');
  });
  it('доля кольца идёт от полной к пустой', () => {
    const running = startTimer(resetTimer('break'), 0);
    expect(remainingShare(resetTimer('focus'), 0)).toBe(1);
    expect(remainingShare(running, 150000)).toBe(0.5);
    expect(remainingShare(running, 999999)).toBe(0);
  });
});
