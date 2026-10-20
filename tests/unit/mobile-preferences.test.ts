import { describe, expect, it } from 'vitest';
import {
  defaultPreferences,
  parsePreferences,
} from '../../apps/mobile/src/core/preferences/preferences';

describe('Настройки до входа в аккаунт', () => {
  it.each([null, '', '{broken', 'null', '[]', '{"version":9,"theme":"dark"}'])(
    'открывает приложение с безопасными настройками при %s',
    (value) => {
      expect(parsePreferences(value)).toEqual(defaultPreferences);
    },
  );
  it('сохраняет допустимый язык, если значение темы повреждено', () => {
    expect(parsePreferences('{"version":1,"theme":"unexpected","language":"uk"}')).toEqual({
      version: 1,
      theme: 'system',
      language: 'uk',
      reducedMotion: false,
      haptics: true,
      accent: 'forest',
    });
  });
  it('восстанавливает тёмную тему и явный язык без подмены на системный', () => {
    expect(parsePreferences('{"version":1,"theme":"dark","language":"ru"}')).toEqual({
      version: 1,
      theme: 'dark',
      language: 'ru',
      reducedMotion: false,
      haptics: true,
      accent: 'forest',
    });
  });
  it('помнит «Меньше движения» и выключенную вибрацию', () => {
    expect(
      parsePreferences(
        '{"version":1,"theme":"light","language":"en","reducedMotion":true,"haptics":false}',
      ),
    ).toMatchObject({ reducedMotion: true, haptics: false });
    expect(parsePreferences('{"version":1,"reducedMotion":"да","haptics":0}')).toMatchObject({
      reducedMotion: false,
      haptics: true,
      accent: 'forest',
    });
  });
  it('помнит цветовую тему, а незнакомую превращает в «Лес» (HZ-08)', () => {
    expect(parsePreferences('{"version":1,"accent":"ocean"}').accent).toBe('ocean');
    expect(parsePreferences('{"version":1,"accent":"neon"}').accent).toBe('forest');
    expect(parsePreferences('{"version":1}').accent).toBe('forest');
  });
});
