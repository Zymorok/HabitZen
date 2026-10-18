import { describe, expect, it } from 'vitest';
import {
  depth,
  layerWidth,
  seededRandom,
  skyline,
  smoothstep,
  swayAngle,
} from '../../apps/mobile/src/features/onboarding/world/geometry';

describe('геометрия мира первого запуска', () => {
  it('каждого слоя хватает на все пять страниц при его скорости', () => {
    const page = 390;
    for (const factor of Object.values(depth)) {
      const width = layerWidth(page, factor);
      // NOTE: на последней странице слой сдвинут на 4 × page × factor и должен закрывать экран
      expect(width - 4 * page * factor).toBeGreaterThanOrEqual(page - 0.001);
    }
  });

  it('небо держится над хребтом, а хребет — над землёй', () => {
    for (const [width, groundY, height] of [
      [390, 600, 844],
      [360, 470, 640],
      [480, 760, 900],
    ] as const) {
      const sky = skyline(width, groundY, height);
      expect(sky.mountainRidge).toBeLessThan(sky.hillRidge);
      expect(sky.hillRidge).toBeLessThan(groundY);
      expect(sky.sunY).toBeLessThan(sky.mountainRidge);
      expect(sky.moonY).toBeLessThan(sky.mountainRidge);
      expect(sky.birdY).toBeLessThan(sky.mountainRidge);
    }
  });

  it('звёзды и трава стоят на одних местах при каждом запуске', () => {
    const first = seededRandom(7);
    const second = seededRandom(7);
    const a = Array.from({ length: 20 }, first);
    const b = Array.from({ length: 20 }, second);
    expect(a).toEqual(b);
    expect(a.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('смена темы и покачивание остаются в своих границах', () => {
    expect(smoothstep(0.3, 0.8, 0)).toBe(0);
    expect(smoothstep(0.3, 0.8, 1)).toBe(1);
    expect(smoothstep(0.3, 0.8, 0.55)).toBeCloseTo(0.5, 5);
    for (let t = 0; t < 120; t += 0.37) {
      expect(Math.abs(swayAngle(t, 4, 1.1, 0.5))).toBeLessThanOrEqual(4 * 1.22 + 1e-9);
    }
  });
});
