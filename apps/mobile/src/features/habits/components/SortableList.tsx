import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { motion } from '@habitzen/design/motion';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { useHaptics } from '../../../shared/haptics';
import { Icon } from '../../../shared/ui/Icon';
import { moveItem, orderOf, positionsOf, slotAt } from '../order';
import type { Positions } from '../order';

/**
 * Список с перетаскиванием (HZ-09): строку берут за «≡» и тянут, остальные пружиной
 * уступают место. Отпустил — порядок уходит на сервер одним запросом.
 * NOTE: Для читалки экрана у каждой строки есть действия «Выше» и «Ниже» — жест не обязателен.
 * PERF: Во время жеста позиции живут в общем значении Reanimated, без перерисовки React.
 */
export function SortableList({
  ids,
  rowHeight,
  renderRow,
  onReorder,
  onDragging,
  moveUpLabel,
  moveDownLabel,
  handleLabel,
}: {
  readonly ids: readonly string[];
  readonly rowHeight: number;
  readonly renderRow: (id: string, index: number) => ReactNode;
  readonly onReorder: (ids: string[]) => void;
  /** Пока строку тянут, прокрутку экрана лучше выключить. */
  readonly onDragging?: (dragging: boolean) => void;
  readonly moveUpLabel: string;
  readonly moveDownLabel: string;
  readonly handleLabel: (id: string) => string;
}) {
  const positions = useSharedValue<Positions>(positionsOf(ids));
  const key = ids.join('|');
  // NOTE: Сервер подтвердил порядок или пришёл новый список — позиции берём из него.
  useEffect(() => {
    positions.value = positionsOf(key ? key.split('|') : []);
  }, [key, positions]);

  const commit = (next: Positions) => {
    const order = orderOf(next);
    if (order.join('|') !== key) onReorder(order);
  };
  const moveBy = (id: string, step: -1 | 1) => {
    const from = positions.value[id] ?? 0;
    const to = Math.max(0, Math.min(ids.length - 1, from + step));
    if (to === from) return;
    const next = moveItem(positions.value, from, to);
    positions.value = next;
    commit(next);
  };

  return (
    <View style={{ height: ids.length * rowHeight }} testID="sortable-list">
      {ids.map((id, index) => (
        <SortableRow
          key={id}
          id={id}
          count={ids.length}
          rowHeight={rowHeight}
          positions={positions}
          onDrop={() => commit(positions.value)}
          onDragging={onDragging}
          onMove={(step) => moveBy(id, step)}
          moveUpLabel={moveUpLabel}
          moveDownLabel={moveDownLabel}
          handleLabel={handleLabel(id)}
        >
          {renderRow(id, index)}
        </SortableRow>
      ))}
    </View>
  );
}

function SortableRow({
  id,
  count,
  rowHeight,
  positions,
  onDrop,
  onDragging,
  onMove,
  moveUpLabel,
  moveDownLabel,
  handleLabel,
  children,
}: {
  readonly id: string;
  readonly count: number;
  readonly rowHeight: number;
  readonly positions: SharedValue<Positions>;
  readonly onDrop: () => void;
  readonly onDragging: ((dragging: boolean) => void) | undefined;
  readonly onMove: (step: -1 | 1) => void;
  readonly moveUpLabel: string;
  readonly moveDownLabel: string;
  readonly handleLabel: string;
  readonly children: ReactNode;
}) {
  const { theme } = useAppPreferences();
  const haptics = useHaptics();
  const top = useSharedValue((positions.value[id] ?? 0) * rowHeight);
  const start = useSharedValue(0);
  const active = useSharedValue(false);
  const lift = useSharedValue(0);

  // NOTE: Соседи уезжают пружиной, когда тянут другую строку.
  useAnimatedReaction(
    () => positions.value[id] ?? 0,
    (position, previous) => {
      if (position !== previous && !active.value) {
        top.value = withSpring(position * rowHeight, motion.pressSpring);
      }
    },
  );

  const pickUp = () => {
    haptics.medium();
    onDragging?.(true);
  };
  const drop = () => {
    onDragging?.(false);
    onDrop();
  };
  const tick = () => haptics.selection();

  const pan = Gesture.Pan()
    .onStart(() => {
      active.value = true;
      start.value = top.value;
      lift.value = withSpring(1, motion.pressSpring);
      runOnJS(pickUp)();
    })
    .onUpdate((event) => {
      top.value = start.value + event.translationY;
      const from = positions.value[id] ?? 0;
      const to = slotAt(top.value, rowHeight, count);
      if (to !== from) {
        positions.value = moveItem(positions.value, from, to);
        runOnJS(tick)();
      }
    })
    .onFinalize(() => {
      if (!active.value) return;
      active.value = false;
      lift.value = withSpring(0, motion.pressSpring);
      top.value = withSpring((positions.value[id] ?? 0) * rowHeight, motion.pressSpring);
      runOnJS(drop)();
    });

  const style = useAnimatedStyle(() => ({
    top: top.value,
    zIndex: active.value ? 10 : 0,
    transform: [{ scale: 1 + lift.value * 0.03 }],
  }));
  // NOTE: Тень — отдельный слой с неподвижной тенью, меняется только прозрачность:
  // строка тени boxShadow на Android не всегда снималась после того, как строку отпустили.
  const shadowStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, lift.value)) }));

  return (
    <Animated.View
      style={[styles.row, { height: rowHeight, backgroundColor: theme.surface }, style]}
      accessibilityActions={[
        { name: 'moveUp', label: moveUpLabel },
        { name: 'moveDown', label: moveDownLabel },
      ]}
      onAccessibilityAction={(event) => onMove(event.nativeEvent.actionName === 'moveUp' ? -1 : 1)}
      testID={`sortable-${id}`}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.shadow, { backgroundColor: theme.surface }, shadowStyle]}
      />
      <GestureDetector gesture={pan}>
        <View
          style={styles.handle}
          accessibilityLabel={handleLabel}
          accessibilityRole="button"
          testID="sortable-handle"
        >
          <Icon name="menu" size={20} color={theme.textMuted} />
        </View>
      </GestureDetector>
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
  },
  shadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 18,
    boxShadow: '0 8px 20px rgba(18,47,32,0.18)',
  },
  // NOTE: Ручка шире значка: за неё легко взяться пальцем (не меньше 44 точек).
  handle: { width: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignSelf: 'stretch' },
});
