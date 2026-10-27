import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useHaptics } from '../../../shared/haptics';
import { useEffect, useRef } from 'react';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { motion } from '@habitzen/design/motion';
import type { SharedValue } from 'react-native-reanimated';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../../core/providers/AppPreferencesProvider';
import { habitArt } from '../../../shared/habit-art';
import { habitColor } from '../../../shared/habit-look';
import { amountText, formatAmount, goalOfText, goalStep, isCountGoal } from '../../habits/goal';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import type { PlanItem } from '../data/plan-api';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PLUS_SIZE = 38;
const PLUS_STROKE = 3;
const PLUS_RADIUS = (PLUS_SIZE - PLUS_STROKE) / 2;
const PLUS_LENGTH = 2 * Math.PI * PLUS_RADIUS;

/**
 * Строка плана (кадр 02): значок, название, кружок состояния.
 * Нажатие — к удержанию (кадр 04); свайп влево — «Сегодня отдых»; долгое нажатие — меню.
 * У привычки с количеством вместо кружка — «+» с кольцом: «3 из 8 стаканов» набираются по одному.
 * NOTE: Для озвучивания те же действия доступны через accessibilityActions — жест не обязателен.
 */
export function PlanRow({
  item,
  busy,
  last,
  onOpen,
  onSkip,
  onMenu,
  onAdd,
}: {
  readonly item: PlanItem;
  readonly busy: boolean;
  readonly last: boolean;
  readonly onOpen: () => void;
  readonly onSkip: () => void;
  readonly onMenu: () => void;
  readonly onAdd: () => void;
}) {
  const { t, i18n } = useTranslation('habits');
  const haptics = useHaptics();
  const { theme } = useAppPreferences();
  const swipe = useRef<SwipeableMethods>(null);
  const done = item.status === 'completed';
  // NOTE: Выполненная карточка (задание, HZ-11): значок и текст плавно бледнеют, название
  // зачёркивается; зелёная галочка остаётся яркой — как на макете кадра 02.
  const dim = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    dim.value = withTiming(done ? 1 : 0, { duration: 320 });
  }, [done, dim]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: 1 - dim.value * 0.45 }));
  const resting = item.status === 'skipped';
  const count = isCountGoal(item.target, item.goalUnit);
  const addLabel = t('add_amount', {
    amount: amountText(t, i18n.language, goalStep(item.goalUnit), item.goalUnit),
  });
  const details = [
    count
      ? t('progress_of', {
          done: formatAmount(item.progress, i18n.language),
          goal: goalOfText(t, i18n.language, item.target, item.goalUnit),
        })
      : null,
    item.perWeek ? t('week_progress', { done: item.weekDone, total: item.perWeek }) : null,
  ].filter((part): part is string => Boolean(part));
  const canAdd = count && !done && !resting;
  return (
    <ReanimatedSwipeable
      ref={swipe}
      enabled={item.status === 'pending' && !busy}
      friction={1.6}
      rightThreshold={64}
      overshootRight={false}
      renderRightActions={(progress) => <RestAction progress={progress} />}
      onSwipeableOpen={() => {
        swipe.current?.close();
        haptics.selection();
        onSkip();
      }}
    >
      {/* NOTE: «+» — соседняя кнопка, а не вложенная: кнопка внутри кнопки ломает веб и диктора. */}
      <View
        testID="plan-row"
        style={[
          styles.row,
          { backgroundColor: theme.surface },
          !last ? { borderBottomColor: theme.border } : null,
          !last ? styles.divider : null,
        ]}
      >
        <Pressable
          onPress={onOpen}
          onLongPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          accessibilityState={{ checked: done, busy }}
          accessibilityHint={details.length > 0 ? details.join(', ') : undefined}
          accessibilityActions={[
            { name: 'activate', label: t('hold') },
            { name: 'longpress', label: t('menu') },
            ...(canAdd ? [{ name: 'increment', label: addLabel }] : []),
          ]}
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent.actionName;
            if (action === 'longpress') onMenu();
            else if (action === 'increment') onAdd();
            else onOpen();
          }}
          testID="plan-row-open"
          style={styles.touch}
        >
          {/* NOTE: Цветной значок без подложки — как в списке на кадре 02. */}
          <Animated.Image
            source={habitArt(item.iconKey)}
            style={[styles.art, resting ? styles.artResting : null, fadeStyle]}
            resizeMode="contain"
            accessible={false}
          />
          <Animated.View style={[styles.text, fadeStyle]} testID="plan-row-text">
            <AppText
              numberOfLines={1}
              style={[
                styles.title,
                resting || done
                  ? { color: theme.textMuted, textDecorationLine: 'line-through' }
                  : null,
              ]}
              testID="plan-row-title"
            >
              {item.title}
            </AppText>
            {details.length > 0 ? (
              <AppText
                variant="small"
                numberOfLines={1}
                style={[styles.details, { color: theme.textMuted }]}
                testID="plan-row-details"
              >
                {details.join(' · ')}
              </AppText>
            ) : null}
          </Animated.View>
          {busy ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : resting ? (
            <View style={[styles.restChip, { backgroundColor: theme.surfaceMuted }]}>
              <Icon name="moon" size={13} color={theme.textMuted} />
              <AppText variant="small" style={{ color: theme.textMuted }}>
                {t('rest_label')}
              </AppText>
            </View>
          ) : done ? (
            <Animated.View
              entering={FadeIn.duration(260)}
              style={[styles.check, { backgroundColor: theme.success, borderColor: theme.success }]}
            >
              <Icon name="check" size={14} color="#FFFDF3" strokeWidth={2.6} />
            </Animated.View>
          ) : canAdd ? null : (
            <View style={[styles.check, { borderColor: theme.primarySoft }]} />
          )}
        </Pressable>
        {canAdd && !busy ? (
          <PlusButton
            share={item.progress / item.target}
            color={habitColor(item.colorKey)}
            label={addLabel}
            onPress={() => {
              haptics.light();
              onAdd();
            }}
          />
        ) : null}
      </View>
    </ReanimatedSwipeable>
  );
}

/** «+» в кольце: кольцо дорастает до новой доли цели, кнопка коротко подпрыгивает. */
function PlusButton({
  share,
  color,
  label,
  onPress,
}: {
  readonly share: number;
  readonly color: string;
  readonly label: string;
  readonly onPress: () => void;
}) {
  const { theme } = useAppPreferences();
  const fill = useSharedValue(Math.min(1, share));
  const bump = useSharedValue(1);
  useEffect(() => {
    fill.value = withTiming(Math.min(1, share), { duration: 320 });
  }, [share, fill]);
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: PLUS_LENGTH * (1 - fill.value),
  }));
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  return (
    <Pressable
      onPress={() => {
        bump.value = withSequence(
          withTiming(0.86, { duration: 70 }),
          withSpring(1, motion.pressSpring),
        );
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="plan-row-add"
    >
      <Animated.View style={[styles.plus, bumpStyle]}>
        <Svg width={PLUS_SIZE} height={PLUS_SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={PLUS_SIZE / 2}
            cy={PLUS_SIZE / 2}
            r={PLUS_RADIUS}
            strokeWidth={PLUS_STROKE}
            fill="none"
            stroke={theme.surfaceMuted}
          />
          <AnimatedCircle
            cx={PLUS_SIZE / 2}
            cy={PLUS_SIZE / 2}
            r={PLUS_RADIUS}
            strokeWidth={PLUS_STROKE}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${PLUS_LENGTH} ${PLUS_LENGTH}`}
            animatedProps={ringProps}
            transform={`rotate(-90 ${PLUS_SIZE / 2} ${PLUS_SIZE / 2})`}
          />
        </Svg>
        <Icon name="plus" size={18} color={color} strokeWidth={2.4} />
      </Animated.View>
    </Pressable>
  );
}

/** Подложка свайпа: «Сегодня отдых» проявляется по мере сдвига строки. */
function RestAction({ progress }: { readonly progress: SharedValue<number> }) {
  const { t } = useTranslation('habits');
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.6, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1]) }],
  }));
  return (
    <View style={styles.restAction}>
      <Animated.View style={[styles.restInner, style]}>
        <Icon name="moon" size={18} color="#8A5A2B" />
        <AppText variant="small" style={styles.restText}>
          {t('skipped')}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 14 },
  touch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    minHeight: 56,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  art: { width: 30, height: 30 },
  artResting: { opacity: 0.45 },
  text: { flex: 1, gap: 1 },
  title: { fontFamily: 'Manrope_500Medium', fontSize: 15, lineHeight: 21, alignSelf: 'stretch' },
  details: { alignSelf: 'stretch' },
  plus: {
    width: PLUS_SIZE,
    height: PLUS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  restAction: {
    width: 132,
    backgroundColor: '#FBE3C8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restInner: { alignItems: 'center', gap: 3 },
  restText: { color: '#8A5A2B', fontFamily: 'Manrope_600SemiBold' },
});
