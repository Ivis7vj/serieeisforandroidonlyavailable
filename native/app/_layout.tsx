import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { NotificationToast } from '@/components/NotificationToast';
import { UpdateService, UpdateInfo } from '../src/services/UpdateService';
import { UpdatePopup } from '../src/components/updates/UpdatePopup';
import { MonthEndPopup } from '@/components/popups/MonthEndPopup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { NETWORK_ERROR_EVENT } from '@/utils/network-event';

import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import "../global.css";

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { useEffect, useState } from 'react';
import { useSegments, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Network from 'expo-network';
import { NetworkBlocker } from '@/components/security/NetworkBlocker';

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
  const [toastContent, setToastContent] = useState({ title: '', message: '' });
  const [isOffline, setIsOffline] = useState(false);

  const [showMonthEndPopup, setShowMonthEndPopup] = useState(false);

  // Month End Trigger Logic
  useEffect(() => {
    const checkMonthEnd = async () => {
      if (!currentUser || isGuest) return;

      const today = new Date();
      // Check if tomorrow is the 1st of next month (robust way to find last day)
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Real Logic: Check if Last Day of Month
      const isLastDay = tomorrow.getDate() === 1;

      if (isLastDay) {
        const key = `month_end_shown_${today.getMonth()}_${today.getFullYear()}`;
        const shown = await AsyncStorage.getItem(key);
        if (!shown) {
          setShowMonthEndPopup(true);
        }
      }
    };

    // Check after a small delay to ensure app is interactive
    const t = setTimeout(checkMonthEnd, 3000);
    return () => clearTimeout(t);
  }, [currentUser, isGuest]);

  // Global Error Listener for suppressed network errors
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(NETWORK_ERROR_EVENT, () => {
      setIsOffline(true);
    });
    return () => sub.remove();
  }, []);

  const handleMonthEndDraw = async () => {
    setShowMonthEndPopup(false);
    const today = new Date();
    const key = `month_end_shown_${today.getMonth()}_${today.getFullYear()}`;
    await AsyncStorage.setItem(key, 'true');

    // Navigate to Diary with Export Highlight
    router.push({
      pathname: '/profile-section',
      params: {
        uid: currentUser?.uid,
        type: 'Diary',
        highlightExport: 'true'
      }
    } as any);
  };

  const closeMonthEnd = async () => {
    setShowMonthEndPopup(false);
    // Mark as shown so we don't spam
    const today = new Date();
    const key = `month_end_shown_${today.getMonth()}_${today.getFullYear()}`;
    await AsyncStorage.setItem(key, 'true');
  };

  // Network Monitoring
  useEffect(() => {
    // Check initial state
    Network.getNetworkStateAsync().then(state => {
      if (state.isConnected === false) setIsOffline(true);
    });

    // Check periodically as expo-network doesn't have a reliable "listener" for all platforms in Expo GO without NetInfo
    // But we can check on focus or specific intervals if needed.
    // However, user said "show blocker when connection failed in backend"
    // So we can also trigger it from the blocker itself or a global state.
    const interval = setInterval(async () => {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false) {
        setIsOffline(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const rootSegment = segments?.[0];
  const isAtLogin = rootSegment === 'login';
  const isAtTabs = rootSegment === '(tabs)';
  const isAtRoot = !rootSegment;
  const isAtCorrectPlace = ((currentUser || isGuest) && !isAtLogin) || (!currentUser && !isGuest && isAtLogin) || isSigningUp;

  useEffect(() => {
    const t = setTimeout(() => setLoadingTimeout(true), 1500); // 1.5s max for auth blocker
    return () => clearTimeout(t);
  }, [authLoading]);

  // 5-Second Minimum Loading Delay Logic
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // Enforce 5 seconds minimum "Splash" time
    const t = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  const loading = authLoading && !loadingTimeout;

  useEffect(() => {
    if (!appReady) return; // Wait only for fonts

    // Aggressive Splash Hide as soon as fonts are ready
    const hideSplash = async () => {
      try {
        console.log('Root: Hiding splash (App Ready)');
        await SplashScreen.hideAsync();
      } catch (e) {
        console.log('Root: Splash hide error', e);
      }
    };

    hideSplash();

    // Redirections happen separate from splash visibility for SPEED
    // BUT we now gate this with minTimeElapsed for the visual transition
    if (loading || !minTimeElapsed) return;

    const rootSegment = segments?.[0];
    const isAtLogin = rootSegment === 'login';
    const isAtTabs = rootSegment === '(tabs)';
    const isAtRoot = !rootSegment;

    // Redirection Logic
    if (!currentUser && !isGuest && !isSigningUp) {
      if (isAtTabs || isAtRoot) {
        router.replace('/login');
      }
    } else if (currentUser && !isSigningUp) {
      if (isAtLogin || isAtRoot) {
        router.replace('/(tabs)');
      }
    }
  }, [currentUser, loading, minTimeElapsed, segments, appReady, isGuest]);

  // Handle Notifications Registration
  useEffect(() => {
    if (currentUser && appReady && !loading && minTimeElapsed) {
      // Check permissions BEFORE registering to decide if we show the "You get notifications" toast
      Notifications.getPermissionsAsync().then(({ status: existingStatus }) => {
        import('@/utils/notification-service').then(({ notificationService }) => {
          notificationService.registerForPushNotificationsAsync(currentUser.uid)
            .then(token => {
              // Only show the registration toast if permission was NOT granted initially (new signup/allow)
              if (token && existingStatus !== 'granted') {
                setToastContent({ title: 'Notifications On', message: 'You will now receive updates about your series.' });
                setToastVisible(true);
              }
            })
            .catch(err => console.error('[Root] Token registration error:', err));
        });
      });
    }
  }, [currentUser, appReady, loading, minTimeElapsed]);

  // Handle Incoming Notifications (In-App)
  useEffect(() => {
    // When app is open and notification arrives
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Root] Notification received in foreground');
      const { title, body } = notification.request.content;
      setToastContent({
        title: title || 'New Notification',
        message: body || 'Check the app for updates.'
      });
      setToastVisible(true);
    });
    return () => subscription.remove();
  }, []);

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

  // Branded Transition Screen: Prevent "Flash" of wrong screens while loading
  // Show Logo + Spinner while fonts are loading OR while auth is validating (up to 1.5s) OR minimum 5s hasn't passed
  if (!appReady || ((loading || !minTimeElapsed) && !isOffline)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" />
        <Image
          source={require('../assets/images/icon.png')}
          style={{ width: 100, height: 100, marginBottom: 20 }}
          contentFit="contain"
        />
        <ActivityIndicator size="small" color="#FFCC00" />
        {/* Network blocker can still overlay here if needed */}
        <NetworkBlocker
          isVisible={isOffline}
          onCancel={() => setIsOffline(false)}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ThemeProvider value={CustomDarkTheme}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', contentStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="friend-activity-detail" options={{ presentation: 'modal', title: 'Activity' }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="banner-search" />
          <Stack.Screen name="share-sticker/index" />
          <Stack.Screen name="person/[id]" />
          <Stack.Screen name="series-seasons/[id]" />
          <Stack.Screen name="series-credits/[id]" />
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
        <NotificationToast
          visible={toastVisible}
          title={toastContent.title}
          message={toastContent.message}
          onHide={() => setToastVisible(false)}
        />
        <NetworkBlocker
          isVisible={isOffline}
          onCancel={() => setIsOffline(false)}
        />
        <MonthEndPopup
          visible={showMonthEndPopup}
          onClose={closeMonthEnd}
          onNavigate={handleMonthEndDraw}
        />
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

    // Safety timeout for fonts (1.5s)
    const t = setTimeout(() => {
      console.log('Root: Font timeout reached');
      setFontTimeout(true);
    }, 1500);

    // CRITICAL: Force hide splash screen after 3.0 seconds NO MATTER WHAT.
    const splashFailsafe = setTimeout(() => {
      console.log('Root: Forcing splash hide (failsafe)');
      SplashScreen.hideAsync().catch(() => { });
    }, 3000);

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
