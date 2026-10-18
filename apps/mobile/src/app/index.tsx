import { Redirect } from 'expo-router';
import { useAuth } from '../core/auth/AuthProvider';
import { OnboardingScreen } from '../features/onboarding/screens/OnboardingScreen';

// NOTE: Вошедший человек сразу попадает в план дня; знакомство — только до входа.
export default function Index() {
  const { status } = useAuth();
  if (status === 'signedIn') return <Redirect href="/today" />;
  return <OnboardingScreen />;
}
