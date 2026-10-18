import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { mobileLogger } from '../../core/diagnostics/mobile-logger';
import type { AudioGateway } from '../contracts';

import rain from '../../../assets/sounds/rain.wav';
import forest from '../../../assets/sounds/forest.wav';
import whiteNoise from '../../../assets/sounds/white_noise.wav';

type Sound = Parameters<AudioGateway['play']>[0];
const SOURCES: Readonly<Record<Sound, typeof rain>> = { rain, forest, white_noise: whiteNoise };
// NOTE: Фон тише системных звуков: он не должен перекрывать музыку или звонок.
const VOLUME = 0.55;

let player: AudioPlayer | null = null;
let current: Sound | null = null;
let modeReady = false;

/**
 * Звуки фокуса (HZ-R16): дождь, лес, белый шум — бесшовные петли из assets/sounds.
 * NOTE: Звук играет только пока приложение на экране; при сворачивании экран фокуса
 * ставит его на паузу, а таймер продолжает идти по сроку на сервере.
 * WARNING: Ошибка звука не должна ломать таймер — она только записывается в журнал.
 */
export const focusAudio: AudioGateway = {
  async play(sound) {
    try {
      if (!modeReady) {
        await setAudioModeAsync({
          shouldPlayInBackground: false,
          interruptionMode: 'mixWithOthers',
        });
        modeReady = true;
      }
      if (current !== sound || !player) {
        player?.remove();
        player = createAudioPlayer(SOURCES[sound]);
        player.loop = true;
        player.volume = VOLUME;
        current = sound;
      }
      player.play();
    } catch {
      void mobileLogger.emit('warning', 'focus', 'focus.sound_failed');
    }
  },
  async stop() {
    try {
      player?.pause();
      player?.remove();
    } catch {
      void mobileLogger.emit('warning', 'focus', 'focus.sound_stop_failed');
    }
    player = null;
    current = null;
  },
};
