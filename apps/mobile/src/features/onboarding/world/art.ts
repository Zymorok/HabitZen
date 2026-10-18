// NOTE: Файл создан скриптом HabitZen-Art\_инструменты\подготовить_слои.py. Не править руками.
import mountainsDay from '../../../../assets/onboarding/mountains_day.webp';
import mountainsNight from '../../../../assets/onboarding/mountains_night.webp';
import hillsDay from '../../../../assets/onboarding/hills_day.webp';
import hillsNight from '../../../../assets/onboarding/hills_night.webp';
import gardenBed from '../../../../assets/onboarding/garden_bed.webp';
import lake from '../../../../assets/onboarding/lake.webp';
import hillRocks from '../../../../assets/onboarding/hill_rocks.webp';
import pathBench from '../../../../assets/onboarding/path_bench.webp';
import tree from '../../../../assets/onboarding/tree.webp';
import sapling from '../../../../assets/onboarding/sapling.webp';
import lantern from '../../../../assets/onboarding/lantern.webp';
import grass1 from '../../../../assets/onboarding/grass_1.webp';
import grass2 from '../../../../assets/onboarding/grass_2.webp';
import grass3 from '../../../../assets/onboarding/grass_3.webp';
import flowers1 from '../../../../assets/onboarding/flowers_1.webp';
import flowers2 from '../../../../assets/onboarding/flowers_2.webp';
import bush from '../../../../assets/onboarding/bush.webp';
import reeds from '../../../../assets/onboarding/reeds.webp';
import cloud1 from '../../../../assets/onboarding/cloud_1.webp';
import cloud2 from '../../../../assets/onboarding/cloud_2.webp';
import cloud3 from '../../../../assets/onboarding/cloud_3.webp';
import wolfWalk1 from '../../../../assets/onboarding/wolf_walk_1.webp';
import wolfWalk2 from '../../../../assets/onboarding/wolf_walk_2.webp';
import wolfSit from '../../../../assets/onboarding/wolf_sit.webp';
import wolfHowl from '../../../../assets/onboarding/wolf_howl.webp';
import wolfSleep from '../../../../assets/onboarding/wolf_sleep.webp';
import butterfly1 from '../../../../assets/onboarding/butterfly_1.webp';
import butterfly2 from '../../../../assets/onboarding/butterfly_2.webp';
import leafGreen from '../../../../assets/onboarding/leaf_green.webp';
import leafOrange from '../../../../assets/onboarding/leaf_orange.webp';
import seed from '../../../../assets/onboarding/seed.webp';
import sproutLeaves from '../../../../assets/onboarding/sprout_leaves.webp';
import sproutMound from '../../../../assets/onboarding/sprout_mound.webp';
import rock from '../../../../assets/onboarding/rock.webp';

export const art = {
  mountainsDay: { source: mountainsDay, width: 1774, height: 887, top: 0.3923 },
  mountainsNight: { source: mountainsNight, width: 1774, height: 887, top: 0.3923 },
  hillsDay: { source: hillsDay, width: 1536, height: 1024, top: 0.585 },
  hillsNight: { source: hillsNight, width: 1536, height: 1024, top: 0.584 },
  gardenBed: { source: gardenBed, width: 1000, height: 335 },
  lake: { source: lake, width: 1000, height: 451 },
  hillRocks: { source: hillRocks, width: 1000, height: 411 },
  pathBench: { source: pathBench, width: 1000, height: 578 },
  tree: { source: tree, width: 1000, height: 968 },
  sapling: { source: sapling, width: 727, height: 818 },
  lantern: { source: lantern, width: 332, height: 1000 },
  grass1: { source: grass1, width: 222, height: 134 },
  grass2: { source: grass2, width: 184, height: 232 },
  grass3: { source: grass3, width: 310, height: 166 },
  flowers1: { source: flowers1, width: 226, height: 158 },
  flowers2: { source: flowers2, width: 269, height: 186 },
  bush: { source: bush, width: 292, height: 189 },
  reeds: { source: reeds, width: 246, height: 234 },
  cloud1: { source: cloud1, width: 520, height: 208 },
  cloud2: { source: cloud2, width: 297, height: 170 },
  cloud3: { source: cloud3, width: 412, height: 255 },
  wolfWalk1: { source: wolfWalk1, width: 353, height: 243 },
  wolfWalk2: { source: wolfWalk2, width: 366, height: 244 },
  wolfSit: { source: wolfSit, width: 260, height: 255 },
  wolfHowl: { source: wolfHowl, width: 244, height: 258 },
  wolfSleep: { source: wolfSleep, width: 247, height: 133 },
  butterfly1: { source: butterfly1, width: 227, height: 165 },
  butterfly2: { source: butterfly2, width: 239, height: 168 },
  leafGreen: { source: leafGreen, width: 193, height: 134 },
  leafOrange: { source: leafOrange, width: 185, height: 158 },
  seed: { source: seed, width: 139, height: 185 },
  sproutLeaves: { source: sproutLeaves, width: 983, height: 978, pivotX: 0.4832, pivotY: 0.7168 },
  sproutMound: { source: sproutMound, width: 983, height: 978 },
  rock: { source: rock, width: 1000, height: 397 },
} as const;
