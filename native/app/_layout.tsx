import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, Redirect } from 'expo-router';
import { OneSignal, LogLevel } from 'react-native-onesignal';
import LoginScreen from './login';
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
import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { PlayfairDisplay_400Regular, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { SourceSerif4_400Regular, SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4';
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
  const { currentUser, bootState, authReady, isSigningUp, isGuest } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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

  // 🛡️ OneSignal Initialization
  useEffect(() => {
    try {
      // Remove this log level setting before release
      OneSignal.Debug.setLogLevel(LogLevel.Verbose);

      // OneSignal Initialization
      OneSignal.initialize("dd9fbfd4-3267-443e-9331-9e8c8d482692");

      // Also request permission (optional here, can be elsewhere)
      OneSignal.Notifications.requestPermission(true);

      // Listener for notification clicks
      OneSignal.Notifications.addEventListener('click', (event: any) => {
        console.log('OneSignal: notification clicked:', event);
        const data: any = event.notification.additionalData;
        if (data?.route) {
          let path = data.route;
          if (data.season) path += `?season=${data.season}`;
          if (data.episode) path += `&episode=${data.episode}`;
          console.log('[OneSignal] Navigating to:', path);
          router.push(path as any);
        }
      });
    } catch (e) {
      console.warn("OneSignal initialization failed (likely missing native module):", e);
    }
  }, []);

  // 🆔 OneSignal User Identification
  useEffect(() => {
    try {
      if (currentUser?.uid) {
        OneSignal.login(currentUser.uid);
        if (currentUser.email) {
          OneSignal.User.addEmail(currentUser.email);
        }
      }
    } catch (e) {
      console.warn("OneSignal user sync failed:", e);
    }
  }, [currentUser?.uid]);


  const isAtLogin = pathname.includes('/login');
  const isAtTabs = pathname.includes('(tabs)') || pathname === '/';
  const isAtRoot = pathname === '/';



  useEffect(() => {
    // 1. Hide Native Splash IMMEDIATELY once fonts are loaded (appReady)
    // We rely on the React ActivityIndicator to show "Loading" state if Auth is still pending.
    if (appReady) {
      SplashScreen.hideAsync().catch(() => { });
    }
  }, [appReady]);



  // 3. REMOVED: Redirection Logic (Replaced by Render-Gate below)

  // Handle Notifications Registration gets done in AuthContext now
  // We only show the "Notifications On" toast here if needed, but 
  // since registration is backgrounded in Auth, maybe we can listen for a success event?
  // For now, removing the toast logic on Registration to simplify. 
  // User didn't strictly ask for the toast, just "Notifications work reliably".

  // Handle Incoming Notifications (In-App) - REMOVED: Migrating to OneSignal

  // Branded Transition Screen: Prevent "Flash" of wrong screens while loading
  // 🛡️ STRICT AUTH GATE: Never mount the Stack until Firebase is ready
  // We unblock as soon as authReady is true (Firebase finished initial check)
  if (!appReady || !authReady) {
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

  // 🛡️ RENDER GATE: Strict Logic
  // If not authenticated, not guest, and not signing up -> SHOW LOGIN SCREEN DIRECTLY
  // This bypasses navigation loops entirely.
  const isAuthorized = currentUser || isGuest || isSigningUp;

  if (!isAuthorized) {
    // NOTE: We wrap in ThemeProvider/View to ensure styles/toasts work if needed,
    // but essentially this replaces the Stack.
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ThemeProvider value={CustomDarkTheme}>
          {/* 
            Strict Redirection: 
            If not authorized and not on login page, FORCE redirect to login.
            This prevents 'blank screen' where we render a Stack for a route we shouldn't be on.
          */}
          {!isAtLogin ? (
            <Redirect href="/login" />
          ) : (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
              <Stack.Screen name="login" />
            </Stack>
          )}
        </ThemeProvider>
        {/* Essential Global Toasts/Blockers can still live here if needed */}
        <NetworkBlocker isVisible={isOffline} onCancel={() => setIsOffline(false)} />
        <StatusBar style="light" />
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
    'PlayfairDisplay-Regular': PlayfairDisplay_400Regular,
    'PlayfairDisplay-Bold': PlayfairDisplay_700Bold,
    'SourceSerif4-Regular': SourceSerif4_400Regular,
    'SourceSerif4-SemiBold': SourceSerif4_600SemiBold,
    'Poppins-BlackItalic': require('../assets/fonts/Poppins-BlackItalic.ttf'),
    'Ultra-Regular': require('../assets/fonts/Ultra-Regular.ttf'),
    'AlfaSlabOne-Regular': require('../assets/fonts/AlfaSlabOne-Regular.ttf'),
    'Oswald-Bold': require('../assets/fonts/Oswald-VariableFont_wght.ttf'),
    'Boldonse-Regular': require('../assets/fonts/Boldonse-Regular.ttf'),
    'Poppins-Bold': require('../assets/fonts/poppins.bold.ttf'),
    'ArchivoBlack-Regular': require('../assets/fonts/ArchivoBlack-Regular.ttf'),
  });



  // Emergency safety for fonts - if fonts don't load in 2s (was 10s), we show the UI anyway
  // This fixes the "Lag at splash screen" issue. 
  const [fontTimeout, setFontTimeout] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    UpdateService.checkForUpdate().then(info => {
      if (info) setUpdateInfo(info);
    });
  }, []);


  // 🛡️ Notification Permissions (REMOVED: Migrating to OneSignal)

  useEffect(() => {
    console.log('Root: Layout mounted');

    // Safety timeout for fonts - Reduced to 2000ms to prevent splash lag
    const t = setTimeout(() => {
      if (!fontsLoaded) {
        console.log('Root: Font timeout reached (2s)');
        setFontTimeout(true);
      }
    }, 2000);

    // REMOVED individual failsafe. RootLayoutNav now handles it strictly based on bootState.
    // This satisfies "dont show until homepage loaded".

    return () => {
      clearTimeout(t);
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
      <GlobalErrorBoundary>
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
      </GlobalErrorBoundary>
    </GestureHandlerRootView>
  );
}
