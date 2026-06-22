import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox, View } from 'react-native';
import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { AuthProvider, useAuth } from '@/src/auth';
import { theme } from '@/src/theme';

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    else if (user && (inAuth || segments.length === 0 || segments[0] === undefined)) router.replace('/(tabs)/dashboard');
  }, [user, loading, segments]);

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.surface } }} />;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  useEffect(() => { if (loaded || error) SplashScreen.hideAsync(); }, [loaded, error]);
  if (!loaded && !error) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surface }}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </View>
  );
}
