import type { ImageSourcePropType } from 'react-native';
import { stageIndex } from './stage';

import stage1 from '../../../assets/garden/tree_stage_1.webp';
import stage2 from '../../../assets/garden/tree_stage_2.webp';
import stage3 from '../../../assets/garden/tree_stage_3.webp';
import stage4 from '../../../assets/garden/tree_stage_4.webp';
import stage5 from '../../../assets/garden/tree_stage_5.webp';
import stage6 from '../../../assets/garden/tree_stage_6.webp';
import stage7 from '../../../assets/garden/tree_stage_7.webp';

/**
 * Рисунки дерева по стадиям. Стадии 3 и 4 — те же молодое и большое дерево, что в мире
 * первого запуска; остальные дорисованы в том же стиле.
 * NOTE: Все семь лежат на одном холсте с общей линией земли и масштабом: в одинаковой рамке
 * росток сам по себе маленький, а старое дерево — во весь рост. Рост не «прыгает».
 */
export const TREE_ASPECT = 640 / 597;

const TREE_ART: readonly ImageSourcePropType[] = [
  stage1,
  stage2,
  stage3,
  stage4,
  stage5,
  stage6,
  stage7,
];

export function treeArt(level: number): ImageSourcePropType {
  return TREE_ART[stageIndex(level)] ?? stage4;
}
