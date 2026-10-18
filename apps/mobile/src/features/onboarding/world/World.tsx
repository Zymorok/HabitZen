import { StyleSheet, View } from 'react-native';
import { memo } from 'react';
import { depth } from './geometry';
import { ParallaxLayer } from './primitives';
import { DuskLight, Moon, Sky, Stars, Sun } from './Sky';
import { Birds, Clouds, Hills, Mountains } from './Landscape';
import { Ground } from './Ground';
import {
  ForegroundPlants,
  GardenHero,
  LakeHero,
  LanternHero,
  Plants,
  SproutHero,
  TreeHero,
} from './Heroes';
import { Butterflies, FallingLeaves, Fireflies, Seeds } from './Particles';

/**
 * Весь мир первого запуска — от неба до травы на переднем плане.
 * NOTE: Порядок слоёв — от дальнего к ближнему. Каждый слой едет со своей скоростью.
 */
// PERF: Мир не зависит от пропсов. memo не даёт ему перерисовываться при смене темы или языка —
// иначе сотни слоёв пересобираются разом, поток занят и закат проскакивает рывком.
export const World = memo(function World() {
  return (
    <View pointerEvents="none" style={styles.world} testID="onboarding-world">
      <Sky />
      <ParallaxLayer factor={depth.stars}>
        <Stars />
      </ParallaxLayer>
      <ParallaxLayer factor={depth.sky}>
        <Sun />
        <Moon />
        <Birds />
      </ParallaxLayer>
      <Clouds />
      <Mountains />
      <Hills />
      <ParallaxLayer factor={depth.ground}>
        <Ground />
        <Fireflies />
        <SproutHero />
        <GardenHero />
        <LakeHero />
        <TreeHero />
        <LanternHero />
        <Plants />
        <FallingLeaves />
        <Butterflies />
        <Seeds />
      </ParallaxLayer>
      <ParallaxLayer factor={depth.foreground}>
        <ForegroundPlants />
      </ParallaxLayer>
      <DuskLight />
    </View>
  );
});

const styles = StyleSheet.create({
  world: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
