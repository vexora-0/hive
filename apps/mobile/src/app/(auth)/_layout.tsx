import { Stack } from 'expo-router';
import { colors } from '@/theme';

/**
 * Auth stack layout — wraps login, verify-otp, and onboarding screens.
 * All screens are rendered without a header; navigation chrome is handled
 * within each screen.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.cream },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
