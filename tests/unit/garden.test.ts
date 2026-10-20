import { describe, expect, it } from 'vitest';
import { gardenLevel, levelThreshold } from '../../packages/core/src/garden.ts';
import { stageCards, stageIndex } from '../../apps/mobile/src/features/garden/stage';

/** HZ-06: рост дерева по выполнениям (кадр 10). */
describe('Уровни дерева', () => {
  it('пороги растут на 10 выполнений с каждым уровнем', () => {
    expect([1, 2, 3, 4, 5, 10].map(levelThreshold)).toEqual([0, 10, 30, 60, 100, 450]);
  });
  it('считает уровень и прогресс внутри уровня', () => {
    expect(gardenLevel(0)).toEqual({ level: 1, progress: 0, needed: 10 });
    expect(gardenLevel(9)).toEqual({ level: 1, progress: 9, needed: 10 });
    expect(gardenLevel(10)).toEqual({ level: 2, progress: 0, needed: 20 });
    expect(gardenLevel(66)).toEqual({ level: 4, progress: 6, needed: 40 });
  });
  it('останавливается на десятом уровне', () => {
    expect(gardenLevel(450)).toEqual({ level: 10, progress: 0, needed: null });
    expect(gardenLevel(5000).level).toBe(10);
  });
  it('не принимает неверные числа', () => {
    expect(() => gardenLevel(-1)).toThrow(RangeError);
    expect(() => gardenLevel(1.5)).toThrow(RangeError);
    expect(() => levelThreshold(11)).toThrow(RangeError);
  });
});

describe('Рисунок дерева по уровню', () => {
  it('каждый уровень получает свою стадию, высокие уровни делят рисунки', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(stageIndex)).toEqual([0, 1, 2, 3, 4, 4, 5, 5, 6, 6]);
    expect(stageIndex(0)).toBe(0);
    expect(stageIndex(42)).toBe(6);
  });
  it('карточки уровней: первые четыре, потом текущий уровень — последним', () => {
    expect(stageCards(1)).toEqual([1, 2, 3, 4]);
    expect(stageCards(4)).toEqual([1, 2, 3, 4]);
    expect(stageCards(7)).toEqual([4, 5, 6, 7]);
    expect(stageCards(10)).toEqual([7, 8, 9, 10]);
  });
});
