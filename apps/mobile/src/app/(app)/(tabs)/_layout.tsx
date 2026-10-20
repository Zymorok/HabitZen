import { Tabs } from 'expo-router';
import { TabBar } from '../../../navigation/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // NOTE: «Назад» с экрана дерева возвращает туда, откуда его открыли.
      backBehavior="history"
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="focus" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="profile" />
      {/* NOTE: Кадр 10 живёт среди вкладок, чтобы нижнее меню оставалось на экране, как в макете. */}
      <Tabs.Screen name="garden" options={{ href: null }} />
    </Tabs>
  );
}
