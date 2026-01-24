import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { NotificationToast } from '@/components/NotificationToast';
import { UpdateService, UpdateInfo } from '../src/services/UpdateService';
import { UpdatePopup } from '../src/components/updates/UpdatePopup';

import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import "../global.css";

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { useEffect, useState } from 'react';
import { useSegments, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { OnboardingProvider } from '@/context/onboarding-context';
import { useFonts } from 'expo-font';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GlobalErrorBoundary } from '@/components/security/GlobalErrorBoundary';
import { ToastProvider } from '@/context/toast-context';



const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000',
    card: '#000',
  },
};

function RootLayoutNav({ appReady }: { appReady: boolean }) {
  const { currentUser, isLoading: authLoading, isSigningUp, isGuest } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Safety timeout for the 'loading' state
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadingTimeout(true), 4000);
    return () => clearTimeout(t);
  }, [authLoading]);

  const loading = authLoading && !loadingTimeout;

  useEffect(() => {
    if (loading || !appReady) return;

    const rootSegment = segments?.[0];
    const isAtLogin = rootSegment === 'login';
    const isAtTabs = rootSegment === '(tabs)';
    const isAtRoot = !rootSegment;

    // 1. Handle Redirections FIRST
    if (!currentUser && !isGuest) {
      if (!isAtLogin && !isSigningUp && !isAtRoot) {
        if (isAtTabs) {
          console.log('Root: Redirecting to login (unauthenticated)');
          router.replace('/login');
          return; // Don't hide splash yet
        }
      }
    }

    if (currentUser && !isSigningUp) {
      if (isAtLogin || isAtRoot) {
        console.log('Root: Redirecting to (tabs) (authenticated)');
        router.replace('/(tabs)');
        return; // Don't hide splash yet
      }
    }

    // ONLY SHOW CONTENT AND HIDE SPLASH IF WE ARE WHERE WE BELONG
    const isAtCorrectPlace = (currentUser && isAtTabs) || (!currentUser && isAtLogin) || isSigningUp || isGuest;
    if (!isAtCorrectPlace && !loading) return;

    // Aggressive Splash Hide
    const hideSplash = async () => {
      try {
        console.log('Root: Attempting splash hide');
        await SplashScreen.hideAsync();
      } catch (e) {
        console.log('Root: Splash hide error', e);
      }
    };

    hideSplash();
  }, [currentUser, loading, segments, appReady, isGuest]);

  // Handle Notifications Registration
  useEffect(() => {
    console.log('[Root] Checking Notification Auth State:', { hasUser: !!currentUser, appReady, loading });
    if (currentUser && appReady && !loading) {
      console.log('[Root] Triggering token registration for:', currentUser.uid);
      import('@/utils/notification-service').then(({ notificationService }) => {
        notificationService.registerForPushNotificationsAsync(currentUser.uid)
          .then(token => {
            console.log('[Root] Token registration success:', !!token);
            if (token) setToastVisible(true);
          })
          .catch(err => console.error('[Root] Token registration error:', err));
      });
    }
  }, [currentUser, appReady, loading]);

  // Handle Notification Responses
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      if (data?.route) {
        // Example route: /series/123?season=1&episode=4
        let path = data.route;
        if (data.season) path += `?season=${data.season}`;
        if (data.episode) path += `&episode=${data.episode}`;

        console.log('[NotificationListener] Navigating to:', path);
        router.push(path as any);
      }
    });

    return () => subscription.remove();
  }, []);

  if (loading || !appReady) {
    return null; // Keep splash visible by rendering nothing
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ThemeProvider value={CustomDarkTheme}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', contentStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="series/[id]" />
          <Stack.Screen name="friend-activity-detail" options={{ presentation: 'modal', title: 'Activity' }} />
          <Stack.Screen name="watchlist" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="banner-search" />
          <Stack.Screen name="share-sticker/index" />
          <Stack.Screen
            name="profile-section"
            options={{
              animation: 'slide_from_right',
              animationDuration: 4000,
              contentStyle: { backgroundColor: '#000' },
            }}
          />
          <Stack.Screen
            name="trending/weekly-top"
            options={{
              headerShown: false,
              animation: 'slide_from_bottom',
              presentation: 'modal',
              gestureEnabled: true
            }}
          />
          <Stack.Screen name="review/index" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        </Stack>
        <NotificationToast visible={toastVisible} onHide={() => setToastVisible(false)} />
        <StatusBar style="light" />
      </ThemeProvider>
    </View>
  );
}




export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Anton-Regular': Anton_400Regular,
    'Poppins-BlackItalic': require('../assets/fonts/Poppins-BlackItalic.ttf'),
    'Ultra-Regular': require('../assets/fonts/Ultra-Regular.ttf'),
    'AlfaSlabOne-Regular': require('../assets/fonts/AlfaSlabOne-Regular.ttf'),
    'Oswald-Bold': require('../assets/fonts/Oswald-VariableFont_wght.ttf'),
    'Boldonse-Regular': require('../assets/fonts/Boldonse-Regular.ttf'),
    'Poppins-Bold': require('../assets/fonts/poppins.bold.ttf'),
  });



  // Emergency safety for fonts - if fonts don't load in 4s, we show the UI anyway
  const [fontTimeout, setFontTimeout] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    UpdateService.checkForUpdate().then(info => {
      if (info) setUpdateInfo(info);
    });
  }, []);


  // 🛡️ Notification Permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Root: Failed to get permissions for push notifications!');
      }
    };
    requestPermissions();
  }, []);

  useEffect(() => {
    console.log('Root: Layout mounted');

    // Safety timeout for fonts (1s)
    const t = setTimeout(() => {
      console.log('Root: Font timeout reached');
      setFontTimeout(true);
    }, 1000);

    // 🛡️ COMMIT SIGNAL


    // CRITICAL: Force hide splash screen after 1.0 seconds NO MATTER WHAT.
    // This catches cases where fonts/auth fail to signal ready.
    const splashFailsafe = setTimeout(() => {
      console.log('Root: Forcing splash hide (failsafe)');
      SplashScreen.hideAsync().catch(() => { });
    }, 1000);

    return () => {
      clearTimeout(t);
      clearTimeout(splashFailsafe);
    };
  }, []);

  const appReady = (fontsLoaded || fontTimeout);

  if (!appReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ToastProvider>
            <OnboardingProvider>

              <RootLayoutNav appReady={appReady} />
              {updateInfo && (
                <UpdatePopup
                  updateInfo={updateInfo}
                  onDismiss={() => setUpdateInfo(null)}
                />
              )}
            </OnboardingProvider>
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
