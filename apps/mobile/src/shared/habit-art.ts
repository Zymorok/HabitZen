import type { ImageSourcePropType } from 'react-native';
import { habitIcon } from './habit-look';
import type { IconName } from './ui/Icon';

import book from '../../assets/habits/book.webp';
import drop from '../../assets/habits/drop.webp';
import heart from '../../assets/habits/heart.webp';
import leaf from '../../assets/habits/leaf.webp';
import sun from '../../assets/habits/sun.webp';
import system from '../../assets/habits/system.webp';
import walk from '../../assets/habits/walk.webp';

/**
 * Цветные значки привычек для списка плана дня (кадр 02): капля, книга, кроссовок, облачко,
 * лотос, сердце, солнце. Нарисованы по макету.
 * NOTE: В форме, на кольце удержания и в карточках остаются контурные значки — как на кадрах 03, 04, 09.
 */
const ART: Readonly<Partial<Record<IconName, ImageSourcePropType>>> = {
  book,
  drop,
  heart,
  leaf,
  sun,
  system,
  walk,
};

export function habitArt(key: string): ImageSourcePropType {
  return ART[habitIcon(key)] ?? leaf;
}
